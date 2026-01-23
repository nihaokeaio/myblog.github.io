---
title: OCCT-Geometry
date: 2026-01-16 10:41:17
categories:
    - OCCT
tags:
---

## Geometry

### 基础概念

#### 基本的数据结构
```C++
gp_Pnt =>点
gp_Vec =>向量
gp_Dir =>方向向量

Geom_Curve =>曲线,是几何，参数化几何
Geom_Surface =>曲线，参数化曲面

```
OCCT层级
| 层级   | 示例                 |
| ---- | ------------------ |
| 几何   | `Geom_*`           |
| 拓扑   | `TopoDS_*`         |
| 构造   | `BRepBuilderAPI_*` |
| 高级算法 | `BRepAlgoAPI_*`    |
| 修复   | `ShapeFix_*`       |
| 显示   | `AIS_*`            |


#### 使用案例
***一个基本立方体的创建过程***
```c++
///1. 设置点集
gp_Pnt p1(0, 0, 0);
gp_Pnt p2(10, 0, 0);
gp_Pnt p3(10, 20, 0);
gp_Pnt p4(0, 20, 0);
///2. 创建曲线（这里是直线）
///定义四条直线,几何部分
Handle(Geom_Curve) c1 = new Geom_Line(p1, gp_Dir(p2.XYZ() - p1.XYZ()));
Handle(Geom_Curve) c2 = new Geom_Line(p2, gp_Dir(p3.XYZ() - p2.XYZ()));
Handle(Geom_Curve) c3 = new Geom_Line(p3, gp_Dir(p4.XYZ() - p3.XYZ()));
Handle(Geom_Curve) c4 = new Geom_Line(p4, gp_Dir(p1.XYZ() - p4.XYZ()));
///3. 创建拓扑层 
TopoDS_Edge e1 = BRepBuilderAPI_MakeEdge(c1, p1, p2);
TopoDS_Edge e2 = BRepBuilderAPI_MakeEdge(c2, p2, p3);
TopoDS_Edge e3 = BRepBuilderAPI_MakeEdge(c3, p3, p4);
TopoDS_Edge e4 = BRepBuilderAPI_MakeEdge(c4, p4, p1);
///4. 围起来连成线
BRepBuilderAPI_MakeWire wireBuilder;
wireBuilder.Add(e1);
wireBuilder.Add(e2);
wireBuilder.Add(e3);
wireBuilder.Add(e4);
TopoDS_Wire wire = wireBuilder.Wire();
///5. 创建面
TopoDS_Face face = BRepBuilderAPI_MakeFace(wire); ///注意，这里返回的是一个拓扑层的face，其引用了一个几何的surface，裁剪了几何的surface
///6. 使用 BRep_Tool 拿 Surface
Handle(Geom_Surface) surf = BRep_Tool::Surface(face);
///强转类型
Handle(Geom_Plane) plane = Handle(Geom_Plane)::DownCast(surf); ///代表一个无穷大的平面
auto pln = plane->Pln(); ///数学平面,获得原点和方向
///7. 使用 BRep_Tool 拿 curve
Standard_Real f, l;
Handle(Geom_Curve) c3d = BRep_Tool::Curve(e1, f, l); ///3D空间，c(t)=(t,0,0),t~[f,l]
Handle(Geom2d_Curve) c2d = BRep_Tool::CurveOnSurface(e1, face, f, l); ///UV空间，注意，它属于面，同一条边会存在于多个面内，u(t)=t,v(t)=0
///8. 概念区分
///3D空间         c(t)=(x(t),y(t),z(t))
///UV空间         (u(y),v(t))
///Surface        r(u,v)
///因此，满足      c(t)=r(u(t),v(t))
for (int i = 0; i <= 5; ++i)
{
    double t = f + (l - f) * i / 5.0;

    gp_Pnt p3d = c3d->Value(t);

    gp_Pnt2d uv = c2d->Value(t);
    gp_Pnt pFromUV = surf->Value(uv.X(), uv.Y());

    // 比较 p3d 和 pFromUV
    int x = 1;
}
///9. 拉升face，变成solid,变成一个立方体
gp_Vec vec(0, 0, 10);
TopoDS_Shape solid = BRepPrimAPI_MakePrism(face, vec);
```

效果图如下
![](https://gitee.com/nhkao/pic-go/raw/master/20260121174004043.png)

***创建一个曲面***
```C++
TColgp_Array1OfPnt pts(1, 6);
pts(1) = gp_Pnt(0, 0, 0);
pts(2) = gp_Pnt(5, 0, 0);
pts(3) = gp_Pnt(6, 4, 0);
pts(4) = gp_Pnt(4, 8, 0);
pts(5) = gp_Pnt(2, 12, 0);
pts(6) = gp_Pnt(0, 15, 0);
Handle(Geom_BSplineCurve) profile = GeomAPI_PointsToBSpline(pts).Curve();
TopoDS_Edge edge = BRepBuilderAPI_MakeEdge(profile);
gp_Vec vec(0, 0, 10);
shape = BRepPrimAPI_MakePrism(edge, vec);
```
![](https://gitee.com/nhkao/pic-go/raw/master/20260121175322135.png)

***理解UV***

对于前面的部分，我们只旋转M_PI_4,代码如下
```c++
TColgp_Array1OfPnt pts(1, 6);
pts(1) = gp_Pnt(0, 0, 0);
pts(2) = gp_Pnt(5, 0, 0);
pts(3) = gp_Pnt(6, 0, 4);
pts(4) = gp_Pnt(4, 0, 8);
pts(5) = gp_Pnt(2, 0, 12);
pts(6) = gp_Pnt(0, 0, 15);
Handle(Geom_BSplineCurve) profile = GeomAPI_PointsToBSpline(pts).Curve();
TopoDS_Edge edge = BRepBuilderAPI_MakeEdge(profile);
gp_Ax1 axis({0, 0, 0}, {0, 0, 1});
TopoDS_Shape bottle = BRepPrimAPI_MakeRevol(edge, axis,M_PI_4).Shape();///旋转M_PI_4
```
我们会得到如下的形态
![](https://gitee.com/nhkao/pic-go/raw/master/20260122151949203.png)
它的面，边，顶点个数分别为：\
Face: 1 Edge: 4 Vertex: 8

我们对面遍历，可以得到面的UV
```c++
for (TopExp_Explorer ex(bottle, TopAbs_FACE); ex.More(); ex.Next())
    {
        TopoDS_Face f = TopoDS::Face(ex.Current());
        Handle(Geom_Surface) s = BRep_Tool::Surface(f);
        ///Revol 的参数空间是
        ///S(u,v)=R(u)⋅C(v)
        ///u:旋转角
        ///v:轮廓参数
        if (s->IsKind(STANDARD_TYPE(Geom_SurfaceOfRevolution)))
        {
            side = f;
            Standard_Real u1, u2, v1, v2;
            BRepTools::UVBounds(side, u1, u2, v1, v2);
        }
    }
```
在这里，可以得到，u1, u2, v1, v2分别为:[0,M_PI_4,0,1],其实可以这么说，因为是旋转算法，面积算的公式是:``S(u,v)=R(u)⋅C(v)``,因此，u代表旋转部分，v代表原始样条线母线的参数部分（被归一化为了0-1），因此这里的取值是这样的。

而且如果手动绘制四条Edge在3D空间中形态，可以看到：编号0，1号曲线代表vMin，vMax的u(t)曲线，因此其取值均为0，得到的曲线几何为:(0,0,0)···,以及(0,0,15),而编号2，3的曲线则是uMin,uMax的v(t)曲线，因此得到的起始母线和终止母线，把他画出来效果大概是这样的:
```c++
for (const auto& cPts : curvePts)
    {
        ///[0],[1]会退化成点
        BRepBuilderAPI_MakePolygon poly;
        for (auto& p : cPts)
            poly.Add(p);
        //poly.Close();
        if (!poly.IsDone())
        {
            std::cout << "Polygon not done!" << std::endl;
            continue;
        }
        TopoDS_Wire visEdge = poly.Wire();
        Handle(AIS_Shape) aShape = new AIS_Shape(visEdge);
        myContext->Display(aShape, AIS_WireFrame, 0, false);
    }
```
![](https://gitee.com/nhkao/pic-go/raw/master/20260122153121258.png)
编号0，1的曲线退化为顶点不可见

理解了U,V，我们尝试手动画一条U,V曲线，并将其投影到3D空间中:
```C++
///在UV空间中画一条线，看看其映射到3D空间是怎么样的
Standard_Real u1, u2, v1, v2;
BRepTools::UVBounds(side, u1, u2, v1, v2);
Handle(Geom_Surface) surf = BRep_Tool::Surface(side);
std::vector<gp_Pnt> somePts;
int N = 80;
for (int i = 0; i <= N; ++i)
{
    double t = static_cast<double>(i) / N;

    double u = u1 + (u2 - u1) * t;
    //double u = u1 + (u2 - u1) * 0.5; //一条母线
    //double v = v1 + (v2 - v1) * 0.5; //一条圆弧
    double v = v1 + (v2 - v1) * t;
    gp_Pnt p = surf->Value(u, v);
    somePts.push_back(p);
}
BRepBuilderAPI_MakePolygon poly;
for (auto& p : somePts)
    poly.Add(p);
if (!poly.IsDone())
{
    std::cout << "Polygon not done!" << std::endl;
}
TopoDS_Wire visEdge = poly.Wire();
Handle(AIS_Shape) aShape = new AIS_Shape(visEdge);
myContext->Display(aShape, AIS_WireFrame, 0, false);
```
这里的u,v都是线性增加的，可以看到效果如下:
![](https://gitee.com/nhkao/pic-go/raw/master/20260122153643879.png)
这个效果类似于一条测地线。
