---
title: TrackBall
date: 2025-03-10 15:07:25
categories:
    - Cpp 
    - QT
    - 事件
tags:
    - trackball
---

<div align='center' ><font size=6>TrackBall</font></div>

本文描述TrackBall的原理以及代码设计。

## 理论基础

很容易想到，我们以包围球作为控制对象，用以控制模型的旋转变换。空间中球面的数学公式为：
$$
\begin{aligned}
x^{2}+y^{2}+z^{2}=r^2
\end{aligned}
$$

我们需要将鼠标位置（x,y）转换为空间坐标，假设我们以屏幕中心为圆心，球的半径为r，我们将x,y带入就可以得到z值，也就完成了二维坐标到三维的转换。公式如下：

$$
\begin{aligned}
z=\sqrt{r^2 - (x^{2}+y^{2})}
\end{aligned}
$$

但是这里很显然有一个问题，这个公式需要满足鼠标的位置在半径r内球面内。对于球外部，会出现错误。

因此，对于球外部的鼠标交点，我们以反曲线函数来表示,并且为了更好的过度，我们取$\frac{\sqrt{2}}{2}*r$为过度点：
$$
\begin{aligned}
z=\frac{r^{2}/2}{\sqrt{x^{2}+y^{2}}}
\end{aligned}
$$

因此，我们可以得到最后的公式为：
$$
\begin{aligned}
z&=\sqrt{r^2 - (x^{2}+y^{2})}  & (x^{2}+y^{2}) \leq\frac{r^{2}}{2}\\
z&=\frac{r^{2}/2}{\sqrt{x^{2}+y^{2}}} & (x^{2}+y^{2})>\frac{r^{2}}{2}\\
\end{aligned}
$$

## 代码实现

首先来看类的整体框架：
```c++
class SHORTCUTTOOLMODULE_EXPORT TransMeshHandler :public QObject, public core::IEventHandler, public core::IRenderCore
{
	Q_OBJECT
public:
	TransMeshHandler(IGLWindow* viewer);

	~TransMeshHandler();
	//需要设置一个总节点来放置咬合平面和相关标记点
	void setRootNode(const std::shared_ptr<core::MatrixTransform>& rootNode);

	//使能标志位
	void setVaild(bool vaild);

	void setMesh(const std::shared_ptr<core::Mesh>& mesh);

	virtual bool handle(QEvent* event, IGLWindow* viewer) override;

signals:
	//鼠标松开后发送相应的信号
	void signalTransFinish(MouseButtonMask type, const core::Matrix44f& mat);

private:
	class PImpl;
	std::unique_ptr<PImpl> impl_;
};
```

整个类的使用十分方便，只需要传入节点控制矩阵，所使用的渲染器即可。``setMesh``接口再优化后其实可以不调用。

下面看具体的实现：

```c++
bool TransMeshHandler::PImpl::handle(QEvent* event, IGLWindow* viewer)
{
	if (!handlerVaild_)
		return false;

	auto render = viewer->asViewer();

	switch (event->type())
	{
	case IEventHandler::PUSH:
	{
		handlePush(event, render);
		break;
	}
	case IEventHandler::DRAG:
	{
		handleDrag(event, render);
		break;
	}
	case IEventHandler::RELEASE:
	{
		handleRelease(event, render);
		break;
	}
	default:
		break;
	}
	return false;
}
```

该部分是事件处理相关的内容。首先handlerVaild_决定了事件是否启用。其次事件主要分为了三部分，鼠标按下，拖拽，松开。

### 按下事件
```c++
bool TransMeshHandler::PImpl::handlePush(QEvent* event, IViewer* viewer)
{
	//只有鼠标右键和中键按下有用
	QMouseEvent* ea = TEvent::asMouseEvent(event);
	if (ea->buttons() == IEventHandler::LEFT_MOUSE_BUTTON)
		return false;

	Intersections intss;
	if (!viewer->computeIntersections(ea->x(), ea->y(), intss))
		return false;

	if (ea->button() == IEventHandler::RIGHT_MOUSE_BUTTON)
	{
		btnRightPress_ = true;
	}
	if (ea->button() == IEventHandler::MIDDLE_MOUSE_BUTTON)
	{
		btnMidPress_ = true;
	}

	lastPos_ = Point2f(ea->x(), ea->y());
	nodeMat_ = rootNode_->getWorldMatrix();
	nodeTMat_.SetIdentity();
	nodeRMat_.SetIdentity();
	nodeTMat_ = nodeTMat_.SetTranslate(nodeMat_.GetColumn3(3));
	nodeRMat_.SetColumn(0, nodeMat_.GetColumn3(0));
	nodeRMat_.SetColumn(1, nodeMat_.GetColumn3(1));
	nodeRMat_.SetColumn(2, nodeMat_.GetColumn3(2));

	return false;
}
```
需要注意的是，我们记录了鼠标右键，中键按下的状态，这是为了将两个按键的事件独立开来，方式干扰。

此外，我们还创建了按下时记录了此时的矩阵，并将其分解为旋转和平移矩阵。这是因为，对于旋转操作，我们需要将其平移到原点旋转，之后再平移回来，因此，这里需要对平移部分做记录。


### 拖拽
```c++
bool TransMeshHandler::PImpl::handleDrag(QEvent* event, IViewer* viewer)
{
	QMouseEvent* ea = TEvent::asMouseEvent(event);
	if (ea->buttons() & IEventHandler::RIGHT_MOUSE_BUTTON)
	{
		if (!btnRightPress_)
			return false;

		Point2f currentP(ea->x(), ea->y());
		Vec3f lastPos3D = projectToTrackball(lastPos_).normalized();
		Vec3f currentPos3D = projectToTrackball(currentP).normalized();
		Matrix mR = Quaternion<float>::MakeRotateMatrix(currentPos3D, lastPos3D);
		rootNode_->setMatrix(nodeTMat_ * mR * mR * nodeRMat_);
		return false;
	}

	if (ea->buttons() & IEventHandler::MIDDLE_MOUSE_BUTTON)
	{
		if (!btnMidPress_)
			return false;
		Point2f currentP(ea->x(), ea->y());
		Vec3f lastPos3D = projectToPlane(lastPos_);
		Vec3f currentPos3D = projectToPlane(currentP);
		Vec3f moveDir = (currentPos3D - lastPos3D) * sensitivityT_;
		
		Matrix mT;
		mT.SetTranslate(moveDir);
		rootNode_->setMatrix(mT * nodeMat_);
	}
	return false;
}
```

这块是整个TrackBall的核心部分，我们逐个来看。

#### 旋转部分
在这里，我们需要获取两个屏幕坐标，currentP以及lastPos_，并将其投影成三维坐标。这时，我们将屏幕坐标转换为了三维的某个点，我们都已屏幕中心为原点(投影过后坐标为(0,0,0)),我们可以得到两个指向鼠标点的三维向量P0,P1.向量从P0->P1就表示了模型的旋转，因而，我们就可以得到旋转矩阵mR。最后，我们将模型坐标设定为``nodeTMat_ *  mR * nodeRMat_``即可。在代码中，我多设置了一个mR，这是为了调整旋转的灵敏度，其实，这里应该有更好的方法，比如四元数插值！

我们看一下这个投影函数是如何将二维的鼠标点变换成为三维点的。

```C++
Vec3f TransMeshHandler::PImpl::projectToTrackball(const Point2f& screenCoords) const
{
	auto sx = screenCoords.X(), sy = render_->height() - screenCoords.Y();

	Point2f p2d = Point2f(sx / render_->width() - 0.5f, sy / render_->height() - 0.5f);

	//根据鼠标点击位置偏移旋转中心
	float z = 0.0f;
	float r2 = radius * radius * (1.0 / sensitivityR_);
	if (p2d.Length2() < 0.5 * r2)
	{
		z = sqrt(r2 - p2d.Length2());
	}
	else
	{
		z = 0.5 * r2 / p2d.Length();
	}

	return Matrix44f::transform3x3(render_->getModelViewMatrix(), Vec3f(p2d.X(), p2d.Y(), z));
}
```
首先，我们将鼠标坐标归一化到$[-0.5,0.5]^{2}$,之后，我们按照理论部分的结果，计算得到z值，然后，我们将向量从原点变换到模型上。变换得到世界坐标下的向量值。

#### 平移部分

对于平移部分，大致原理相同，这里主要看一下``projectToPlane``函数。

```c++
Vec3f TransMeshHandler::PImpl::projectToPlane(const Point2f& screenCoords) const
{
	Vec3f viewDir = render_->getViewDir();
	Vec3f pointOnMesh = mesh_->getMeshCenter();
	Vec3f screenPnt(screenCoords.X(), render_->height() - screenCoords.Y(), 0);
	Point3f p3D = render_->unProject(screenPnt);
	Vec3f intersectPoint;
	GeomOp::calcIntersectPointOfLineWithPlane(viewDir, pointOnMesh, p3D, p3D + viewDir * 1.0f, intersectPoint);
	return intersectPoint;
}
```
可以看到，对于平移部分，我们首先根据当前摄像机的前方向以及模型的中心点构建一个虚拟平面，然后计算鼠标在该平面的交点，计算得到交点，就实现了将鼠标位置投影成三维空间下的坐标。