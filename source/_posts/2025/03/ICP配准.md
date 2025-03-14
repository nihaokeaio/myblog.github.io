---
title: ICP配准
date: 2025-03-14 15:37:10
categories:
    -算法
	-几何
tags:
    -算法
---


# ICP配准

## 背景：

通常，我们会出现需要把一个模型（点集）匹配到目标模型（点集）的情况，这时，我们就需要求解一个匹配矩阵，实现这个操作，我们把这个矩阵成为配准矩阵！

## 理论：

因为ICP配准是一个误差迭代的过程，所以往往很出现陷入局部最小值导致结果不准确的情况，因此，我们首先可以手动执行粗配准，然后在执行精配准。

我在执行配准时，往往首先将源点云$P$和目标点云$Q$移动到原点，具体的操作就是求取点云的均值点，然后所有点都减去均值点就可以了。

之后，我们来看迭代优化部分!

我们有两组点云：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/18c7df05-36ea-40ca-b81d-1bde2bd33c1b.png)

本质上，我们是对$P$点云执行一个旋转平移的刚体变换，因此，我们可以认为我们所作的操作为：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/55d6e996-5605-414c-9f45-ab88c0a9d500.png)

其中，$R$是旋转部分，$t$是平移部分。

我们的目的就是使变换后的点p‘与目标点q累计的误差值最小。这里，我们使用最常见的欧氏距离来表示点之间的相似程度。因此，我们有如下公式：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/958b11d8-a415-4cd1-945f-6e0383523b51.png)

这里，因为有两个变量，因此，我们分别求解$R$，$t$。

### 1.求解t

我们首先对t求偏导，根据求导公式，我们可以得到：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/3b481ddb-1f34-4241-a2c4-0def2a0831d6.png)

要注意，这里是对t求导，不是R。我们把与i无关的项移到求和式外，就可以得到等式的右边。

我们需要求解的是极值点，因此，我们使等式等于0，就可以得到

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/7ffeb87f-9ee4-4d1f-a091-ca317fbef797.png)

可以看到，这就是一个点集求平均的操作，前提是需要知道R

### 2.求解R

嗯，这里我们不能用求导的方式了。因为求导后又会依赖t，这种循环依赖最后是不会有解的。

我们直接把前面的求解的t带入到最原始的等式中(因为打不出上划线，我用下划线代替了)

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/3a76d442-8850-40e8-b9be-e1a72b5d2dd6.png)

这里的$\overline{\text{p}}$,$\overline{\text{q}}$ 就是前面所说的均值点（质心），那么$\overline{\text{p}}$,$\overline{\text{q}}$其是就是把点移到相对原点的操作嘛！一顿操作后，我们就可以得到如下等式：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/bb66348d-90d4-4a88-95d1-89bf17bdc8b9.png)

其中，$x_i$，$y_i$就是移到相对原点后的点集。

嗯，这时，我们考虑到这一个$3*3·3*1-3*1$的向量与矩阵的变换，那我们干脆直接把平方拆出来吧！于是我们得到下面的结果：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/035468f5-bf0a-4105-91fc-7b42e08bdf7e.png)

嗯，为什么第一步需要转置呢？为啥是前面的部分转置不是后面的转置呢？这时因为这个需要符合矩阵的乘法。也就是说，我们最后得到的是一个数字而不是一个矩阵，所以两者相差一定是$1*3·3*1=1*1$这样的格式。

我们这个式子的变量是$R$，所以我们只需考虑带$R$的项就可以！而且还有一点需要注意，这里的每个项都是一个数字哦（标量）,那么我们立刻就可以知道：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/9d5ff3e2-e507-431e-b2f8-b015abb93ae5.png)

对于标量（1x1的矩阵），转置当然等于自己了！于是我们可以把中间两项合并起来。最后得到下面的结论：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/01027d30-a1c6-4a15-b591-40c4c31ed9fc.png)

其中，$x_i$，$y_i$是一个3x1的向量。为了最后得到一个数以及为了符合矩阵的乘法法则，我们的R必然是一个3x3的矩阵（这不是很早就知道了。。。）

现在的情况是，该怎么计算这个矩阵，使最后的结果最大呢？

嗯~，我们直接把求和式展开吧，那么最后的结果就是：

$$
ret=y_1·R·x_1+y_2·R·x_2+...
$$

我们对这个式子转换一下，可以得到下面的等式：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/4f69f112-6809-48f3-bb2b-47d9d96c7792.png)

这个结果，不就是矩阵的迹嘛。也就是说，我们要求这个矩阵迹的最大值！

对于矩阵的迹，有这么一条性质：

矩阵乘法的迹： tr(AB)=tr(BA)tr(AB)=tr(BA) 即使 AB≠BA；tr(AB)=tr(BA)，它们的迹也相等。

因此，我们可以把等式变换成：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/6b3bca68-a0ba-44dc-80b4-b37618d19d9a.png)

这里把RX当成一个整体来看。

之后就是比较难联想到的一步：我们我令$S=X·Y^{T}$，然后对他做奇异值分解。于是我们有：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/d80b51ac-bcd3-48c1-894a-dc8522829f0b.png)

之所以这么做的原因，是因为R矩阵和奇异值矩阵∑都是对角阵，再求迹时比较方便转换。

于是，我们就可以得到如下结论：

![image.png](https://alidocs.oss-cn-zhangjiakou.aliyuncs.com/res/YdgOkp1emgWLl4BX/img/34f973a4-3737-495c-875e-8bbbe7b349d8.png)

1.  为什么M是正交矩阵，因为左，右奇异矩阵以及R都为正交矩阵，所以M也是正交矩阵。
    
2.  $m_j^{T}*m_j=1$,这是因为正交矩阵列向量彼此正交模长为1
    

所以当$m_{ii}$均为1时，有最大值，那么此时，$M$矩阵必然为单位矩阵$I$，于是，我们就可以求解出$R$！

## 代码部分

```c++
const auto& icp = [&](const Vec3Vector& s, const Vec3Vector& t)->Matrix44f
	{
		std::vector<Eigen::Vector3d> source;
		std::vector<Eigen::Vector3d> target;
		for (const auto& p : s)
		{
			source.push_back(Eigen::Vector3d(p.X(), p.Y(), p.Z()));
		}
		for (const auto& p : t)
		{
			target.push_back(Eigen::Vector3d(p.X(), p.Y(), p.Z()));
		}
		Eigen::Matrix4d mat = icpEigen(source, target);
		Matrix44f ret;
		for (int i = 0; i < 16; ++i)
		{
			ret(i / 4, i % 4) = mat(i);
		}
		ret.transposeInPlace();
		return ret;
	};
```

首先，我们输入我们的源点集s以及目标点集t，并将数据转换成Eigen数据。

之后，我们来看icpEigen的内容：

```c++
const auto& icpEigen = [&](const std::vector<Eigen::Vector3d>& source,
	const std::vector<Eigen::Vector3d>& target,
	int maxIterations = 100, double tolerance = 1e-6)->Eigen::Matrix4d
	{
		std::vector<Eigen::Vector3d> matchedTarget;
		Eigen::Matrix4d transformation = Eigen::Matrix4d::Identity();
		double prevError = std::numeric_limits<double>::max();

		// 1.初始化变换后的源点集
		std::vector<Eigen::Vector3d> transformedSource = source;

		// 迭代优化
		for (int i = 0; i < maxIterations; ++i) {
			matchedTarget = target;
			// 2. 计算质心
			Eigen::Vector3d sourceCentroid(0, 0, 0);
			Eigen::Vector3d targetCentroid(0, 0, 0);
			for (size_t j = 0; j < transformedSource.size(); ++j) {
				sourceCentroid += transformedSource[j];
				targetCentroid += matchedTarget[j];
			}
			sourceCentroid /= transformedSource.size();
			targetCentroid /= matchedTarget.size();

			// 3. 计算协方差矩阵
			Eigen::Matrix3d covariance = Eigen::Matrix3d::Zero();
			for (size_t j = 0; j < transformedSource.size(); ++j)
			{
				covariance += (transformedSource[j] - sourceCentroid) * (matchedTarget[j] - targetCentroid).transpose();
			}

			// 4. 使用 SVD 计算旋转矩阵
			Eigen::JacobiSVD<Eigen::Matrix3d> svd(covariance, Eigen::ComputeFullU | Eigen::ComputeFullV);
			Eigen::Matrix3d rotation = svd.matrixV() * svd.matrixU().transpose();

			// 5. 计算平移向量
			Eigen::Vector3d translation = targetCentroid - rotation * sourceCentroid;

			// 6. 更新变换矩阵
			Eigen::Matrix4d currentTransformation = Eigen::Matrix4d::Identity();
			currentTransformation.block<3, 3>(0, 0) = rotation;
			currentTransformation.block<3, 1>(0, 3) = translation;
			transformation = currentTransformation * transformation;

			// 7. 更新变换后的源点集
			for (auto& p : transformedSource)
			{
				p = rotation * p + translation;
			}

			// 8. 计算误差
			double error = 0;
			for (size_t j = 0; j < transformedSource.size(); ++j)
			{
				error += (transformedSource[j] - matchedTarget[j]).norm();
			}
		}
		return transformation;
	};
```

处理输入点集外，还有两个默认值，迭代次数以及误差阈值。

之后的步骤就是和理论解释的部分完全一致。最后输出一个4x4的齐次矩阵！