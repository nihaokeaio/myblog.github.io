---
title: HalfEdge Structure
date: 2025-03-10 10:46:48
categories:
    - Cpp
    - 数据结构
tags:
    - HalfEdge
---
## The_Half-Edge_Data_Structure

这里我根据网上的教程，编写了一个基于半边数据结构的TriMesh。网上也有很多教程，比如：[半边数据结构基础](https://blog.csdn.net/qq_37366618/article/details/145544514)

首先来看一下TriMesh的定义以及相关的数据结构：
```c++
struct Curvature;
struct Vert;
struct Face;
struct HalfEdge;
class TriMesh;
using namespace MMath;

struct HalfEdge
{
	Vert* vert;					//指向的顶点
	HalfEdge* next;
	HalfEdge* opposite;			//对半边
	Face* face;					//绑定的面
	bool isBoundary;
	bool isSelect = false;
	HalfEdge() :vert(nullptr), next(nullptr), opposite(nullptr), face(nullptr), isBoundary(false) {}
};

struct Curvature
{
	float k1;		//主曲率的最大值，表示主方向
	float k2;		//主曲率的最小值，表示主方向
	HalfEdge* h1;	//主曲率的最大值半边
	HalfEdge* h2;	//主曲率的最小值半边

	//kGauss = k1*k2; 高斯曲率，两主曲率乘积，反映曲面在不同方向弯曲程度是否相同。高斯曲率为正，为球面。高斯曲率为负双曲面
	//kmean = (k1+k2)/2; 两主曲率算数平均数(k1+k2)/2，反映曲面凹凸程度。平均曲率为正，局部凹。平均曲率为负，局部凸
};

struct Vert
{
	int id;
	HalfEdge* halfEdge;			//点出发所在的半边
	Point3f pos;
	Vec3f normal;
	Curvature curve;
	bool isBoundary;
	bool isSelect = false;
	Vert(int ID = -1, const Point3f p = Point3f(), HalfEdge* he = nullptr, Vec3f n = Vec3f(), bool isB = false)
		:id(ID), halfEdge(he), pos(p), normal(n), isBoundary(isB) {}
};

struct Face
{
	int id;
	bool isSelect = false;
	HalfEdge* halfEdge;
	Vec3f normal;
	float area;
	Face(int ID = -1, HalfEdge* he = nullptr) :id(ID), halfEdge(he) {}
};

struct EdgeKey {
	int v1, v2;
	EdgeKey(int vd1 = -1, int vd2 = -1) :v1(vd1), v2(vd2) {}

	bool operator==(const EdgeKey& key) const { return v1 == key.v1 && v2 == key.v2; }

};
struct EdgeKeyHashFuc
{
	std::size_t operator()(const EdgeKey& key) const
	{
		return std::hash<int>()(key.v1) + std::hash<int>()(key.v2);
	}
};

class MYDLLAPI TriMesh
{
public:
	TriMesh() {};
    //...
private:
	std::vector<Vert*>		mVertices_;
	std::vector<Face*>		mFaces_;
	std::vector<HalfEdge*>	mEdges_;
	std::map<int, Vert*> mVertMap_;

	float averageEdgeLength_ = 0.0f;
	std::unordered_map<EdgeKey, HalfEdge*, EdgeKeyHashFuc> mHashmapEdge;
};
```
对于HalfEdge结构，其主要包含了指向的顶点，下一条半边，对边，绑定的面，是否是边缘边，该边是否被选中这几个参数。在构造时，我们往往按照顺时针或者逆时针的方式构造，这样，通过这几个数据结构，我们就可以遍历所有的顶点，边，面片了。

我们看下如何构造TriMesh
```c++
std::shared_ptr<TriMesh> MMeshObject::TriMesh::readMesh(const std::string& meshPath)
{
	if(meshPath.empty())
		return nullptr;
	SmartMesh mesh = core::MeshIO::readMesh(QString::fromStdString(meshPath));
	return TriMesh::toTriMesh(mesh.get());
}

void TriMesh::writeMesh(const TriMesh* triMesh, const std::string& meshPath)
{
	if (meshPath.empty())
		return;
	std::shared_ptr<core::Mesh> mesh = triMesh->toMesh();
	core::MeshIO::writeMesh(*mesh, QString::fromStdString(meshPath));
}
```

从这里看，我们时通过读取Mesh结构，最后得到TriMesh的，接下来我们具体看下``TriMesh::toTriMesh``接口：
```c++
std::shared_ptr<TriMesh> TriMesh::toTriMesh(core::Mesh* mesh)
{
	if (!mesh)
		return nullptr;
	std::shared_ptr<TriMesh> triMesh(new TriMesh);
	int fCount = mesh->getFaceList().size();
	for (int i = 0; i < fCount; ++i)
	{
		core::TFace* f = mesh->getFace(i);

		Vert* verts[3] = { nullptr };
		for (int j = 0; j < 3; ++j)
		{
			core::TVertex* v = f->V(j);
			verts[j] = triMesh->createVertex(toCoreVec(v->P()), v->id());
		}
		triMesh->createFace(verts);
	}
	triMesh->createVertexNormal();
	triMesh->createBoundary();
	triMesh->cmpAverageEdgenorm();
	triMesh->computeCurvature();
	return triMesh;
}
```
从代码中可以看到，我们遍历面片集，从而构建顶点集，并在之后重新创建面片。在TriMesh构建完成后，我们再构建顶点的法线，标识边缘边，计算平均变长，计算曲率。

我们首先看下``createVertex``和``createFace``接口是如何创建顶点和面片的：
```c++
//创建顶点
Vert* TriMesh::createVertex(const Point3f& pos, int id)
{
	if (mVertMap_.find(id) != mVertMap_.end())
		return mVertMap_[id];
	Vert* ver = new Vert(id, pos);
	mVertMap_.insert({ id,ver });
	return ver;
}

//输入一个三角形的三个顶点数据，生成半边和面
Face* TriMesh::createFace(Vert* vertexs[3])
{
	Face* face = new Face();
	HalfEdge* edges[3];
	//创建三角形的三条半边
	for (int i = 0; i < 3; ++i)
	{
		edges[i] = createEdge(vertexs[i % 3], vertexs[(i + 1) % 3]);
		if (edges[i] == nullptr)
		{
			std::cout << "Create Face went wrong" << std::endl;
			return nullptr;
		}
	}

	//将半边通过next连接起来，并和该face绑定
	for (int i = 0; i < 3; ++i)
	{
		edges[i]->next = edges[(i + 1) % 3];
		edges[i]->face = face;
		mEdges_.push_back(edges[i]);
	}
	Vec3f tempVec = (vertexs[1]->pos - vertexs[0]->pos).cross(vertexs[2]->pos - vertexs[1]->pos);
	float area = tempVec.norm() * 0.5;
	Vec3f normal = tempVec.normalize();
	//给面赋值任意一个半边
	face->halfEdge = edges[0];
	face->area = area;
	face->normal = normal;
	mFaces_.push_back(face);
	return face;
}

//通过两个顶点创建一条半边
HalfEdge* TriMesh::createEdge(Vert* v1, Vert* v2)
{
	if (v1 == nullptr || v2 == nullptr)
		return nullptr;

	EdgeKey key(v1->id, v2->id);
	if (mHashmapEdge.find(key) != mHashmapEdge.end())
	{
		return mHashmapEdge[key];
	}

	HalfEdge* h = new HalfEdge();
	HalfEdge* h0 = new HalfEdge();

	h->vert = v2;//记录半边的终点(指向的顶点)
	h0->vert = v1;

	h->opposite = h0;
	h0->opposite = h;

	v1->halfEdge = h;//记录以顶点为起点的半边
	//v2->halfEdge = h0;

	mHashmapEdge.insert({ EdgeKey(v1->id,v2->id),h });
	mHashmapEdge.insert({ EdgeKey(v2->id,v1->id),h0 });
	return h;
}
```

可以看到，我们首先创建``Vert``，设置Id，并将其放到容器中。之后，我们根据三个顶点，按照id小到大的顺序，创建三条半边。创建半边时，我们同样对半边，并设置一个半边的哈希值，防止重复创建相同的半边。之后，我们将半边以id从小到大的顺序串联，并将其绑定一个面片。最后，我们在面片结构中计算法向量，面积，并随意绑定其中一条半边。只有，全部的数据结构就创建完成了！
需要注意的是，计算曲率和边界边会稍微复杂一点。

ok，创建了基本的数据结构后，我们可以实现一些基本的模型算法。这里，我实现了曲面细分，但是对于曲面简化，简单补洞，曲率计算还有一些问题，待日后项目维护后在做进一步打算。这里先给出项目地址。
[halfEdge-TriMesh](https://github.com/nihaokeaio/halfEdge-TriMesh/tree/main)

