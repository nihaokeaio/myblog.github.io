---
title: 加载Obj文件
date: 2025-03-04 20:16:38
categories:
    - Cpp
    - 数据结构
tags:
    - 三维模型加载
---

## OBJ文件的加载

### 文件介绍
obj格式的模型文件是最常见的三维模型文件之一，也是格式最简单的一种。因此我尝试手写一个加载Obj格式的模型文件，并将他装载到自己的数据结构中！

首先看一下通用的Obj模型文件有哪些文件。

![](https://gitee.com/nhkao/pic-go/raw/master/20250304201944237.png)

可以看到，对于一个模型文件而言，最重要的就是一份obj格式的模型文件，一份mtl格式材质文件，以及若干纹理图片。

首先查看一下obj文件。

![](https://gitee.com/nhkao/pic-go/raw/master/20250304202727386.png)

它主要描述了其材质文件，顶点位置v，纹理vt，以及构成面片的索引集f。

对于mtl格式文件，如图

![](https://gitee.com/nhkao/pic-go/raw/master/20250304202924929.png)

其主要描述材质的一些特性，Ka,kd,ks或者需要加载的纹理图片

因此真对这两方面，我们将这部分数据加载进行，就可以实现对Obj文件的加载了。

### 代码部分

```c++
class LoaderMesh
{
public:
    LoaderMesh() = default;

    LoaderMesh(const std::string& filePath)
    {
        loadObjFile(filePath);
    }

    bool loadObjFile(const std::string& filePath);


private:
    // Generate vertices from a list of positions,
	//	tcoords, normals and a face line
    void GenVerticesFromRawOBJ(std::vector<Vertex>& oVerts,
        const Vec3Vector& iPositions,
        const std::vector<Vec2f>& iTCoords,
        const Vec3Vector& iNormals,
        const std::string& icurline);

    // Triangulate a list of vertices into a face by printing
    //	inducies corresponding with triangles within it
    void VertexTriangluation(std::vector<unsigned int>& oIndices,
        const std::vector<Vertex>& iVerts);

    // Load Materials from .mtl file
    bool LoadMaterials(const std::string& path);
public:
    // Loaded Mesh Objects
    std::vector<std::shared_ptr<Mesh>> LoadedMeshes_;
    // Loaded Vertex Objects
    std::vector<Vertex> LoadedVertices_;
    // Loaded Index Positions
    std::vector<unsigned int> LoadedIndices_;
    // Loaded Material Objects
    std::vector<Material> LoadedMaterials_;
};
```

LoaderMesh类的整体架构被划分为了两部分，一部分是obj文件的读取，另一部分是材质文件的读取。

数据读取之后，我们将其存在在几个成员变量中。

其中，Mesh的结构如下：
```c++
class Mesh
{
public:
    Mesh() = default;

    Mesh(const std::vector<Vertex>& vertices, const std::vector<unsigned int>& indices,Material* m=nullptr) :vertices_(vertices), indices_(indices),
        material_(m)
    {       
    }

    virtual ~Mesh()
    {
    }

    std::string name_;
    std::vector<Vertex> vertices_;
    std::vector<unsigned int>indices_;
    Material* material_;
};
```
其中，最主要的就是mesh的顶点集以及顶点序列。以及它所对应的材质。

Vertex类的结构如下：
```c++
struct Vertex
{
    Vec3f position_;

    Vec3f normal_;

    Vec3f color_ ;

    Vec2f textureCoordinate_;
};
```
每一个顶点包含位置，法向量，颜色，纹理坐标四个参数

Material类的结构如下：
```c++
struct Material
{
    Material()
    {
        name_ = "";
        Ns = 0.0f;
        Ni = 0.0f;
        d = 0.0f;
        illum = 0;
    }

    // Material Name
    std::string name_;
    // Ambient Color
    Vec3f Ka;
    // Diffuse Color
    Vec3f Kd;
    // Specular Color
    Vec3f Ks;
    // Specular Exponent
    float Ns;
    // Optical Density
    float Ni;
    // Dissolve
    float d;
    // Illumination
    int illum;
    // Ambient Texture Map
    std::string map_Ka;
    // Diffuse Texture Map
    std::string map_Kd;
    // Specular Texture Map
    std::string map_Ks;
    // Specular Hightlight Map
    std::string map_Ns;
    // Alpha Texture Map
    std::string map_d;
    // Bump Map
    std::string map_bump;
};
```
看起来蛮多的，但对于大部分模型，我们很少用到那么多参数，一般情况下，Ka,Ks,Kd是最主要的参数。

各个数据结构都有了，接下来该考虑如何装在这些数据了。

我们其中一部分为例：
```c++
std::string meshName;
Vec3Vector Positions;
std::string curline;
while (std::getline(file, curline))
{
    if (firstToken(curline) == "o" || firstToken(curline) == "g" || curline[0] == 'g')
    {
        if (firstToken(curline) == "o" || firstToken(curline) == "g")
        {
            meshName = tail(curline);
        }
        else
        {
            meshName = "unnamed";
        }
    }

    // Generate a Vertex position_
    if (firstToken(curline) == "v")
    {
        std::vector<std::string> spos;
        Vec3f vpos;
        split(tail(curline), spos, " ");

        vpos.x = std::stof(spos[0]);
        vpos.y = std::stof(spos[1]);
        vpos.z = std::stof(spos[2]);

        Positions.push_back(vpos);
    }
}
```
通过一些辅助函数的帮助，我们按行读取数据，并将位置信息装在到Positions中。

通过同样的方式，我们可以读取Position，TCoords，Normals。

最后，我们在读取f时需要注意一下他读取的格式：
```c++
 if (firstToken(curline) == "f")
 {
     // Generate the vertices
     std::vector<Vertex> vVerts;
     //读取f，输出vertex
     GenVerticesFromRawOBJ(vVerts, Positions, TCoords, Normals, curline);

     // Add Vertices
     for (int i = 0; i < int(vVerts.size()); i++)
     {
         Vertices.push_back(vVerts[i]);

         LoadedVertices_.push_back(vVerts[i]);
     }

     std::vector<unsigned int> iIndices;

     VertexTriangluation(iIndices, vVerts);

     // Add Indices
     for (int i = 0; i < int(iIndices.size()); i++)
     {
         unsigned int indnum = (unsigned int)((Vertices.size()) - vVerts.size()) + iIndices[i];
         Indices.push_back(indnum);

         indnum = (unsigned int)((LoadedVertices_.size()) - vVerts.size()) + iIndices[i];
         LoadedIndices_.push_back(indnum);

     }
 }
```
这里需要主要``GenVerticesFromRawOBJ``,按行读取f时，其格式可能是v1/vt1/vn1或者v1//vn1，因此需要加以区分。
``VertexTriangluation``函数用以三角化顶点集。不过一般情况下vVerts本身就是三维的，也就是说按行读取f时就是以三个为一组的，因为大部分情况下该函数都是没什么作用的。

由此，我们就有了Vertices，Indices，就可以构造Mesh了。

之后，我们以近乎类似的方法读取Material。

然后通过名字的方式绑定Mesh与Material这样，我们的数据结构就搭建完成了。