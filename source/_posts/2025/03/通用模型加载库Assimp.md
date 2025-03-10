---
title: 通用模型加载库Assimp
date: 2025-03-04 21:11:15
categories:
    - Cpp
    - 数据结构
tags:
    - 三维模型加载
---

<div align='center' ><font size=5>通用模型加载库Assimp</font></div>

***********

前面描述加载obj文件的方式，但是对于大部分模型，如果都自己手写，那过于复杂了。因此引入了通用模型加载库Assimp，可以支持大部分类型的三维模型加载。

本文大概案例演示。

### Mesh结构
首先描述一些我们最终需要的Mesh结构，主要还是包含了顶点集，索引集，纹理集三部分。

```c++
class Mesh
{
public:
	///网格数据
	std::vector<Vertex>vertices;
	std::vector<unsigned int>indices;
	std::vector<Texture>textures;

	///函数
	Mesh(const std::vector<Vertex>& vertices, const std::vector<unsigned int>& indices, const std::vector<Texture>& textures);

	void draw(const MyShader& shader) const;
	void drawInts(const MyShader& shader,int intsCount) const;

	void attachAttribPointer(const std::vector<glm::mat4>& nums);
private:

	unsigned int VAO, VBO, EBO;

	void setupMesh();
};
```

### Texture,Vertex结构
```c++
struct Vertex
{
	glm::vec3 position;
	glm::vec3 normal;
	glm::vec2 texCoords;
};

struct Texture
{
	unsigned int id;
	std::string type;
	aiString path;
};
```

### 加载模型食用方式
```c++
// 模型数据容器  
//std::vector<Mesh> meshes_;
//std::vector<Texture>loadTextures_;

void Model::loadModel(const std::string& path)
{
	Assimp::Importer import;
	const aiScene* scene=import.ReadFile(path,aiProcess_Triangulate|aiProcess_FlipUVs);

	if (!scene || scene->mFlags & AI_SCENE_FLAGS_INCOMPLETE || !scene->mRootNode)
	{
		std::cout << "ERROR::ASSIMP::" << import.GetErrorString() << std::endl;
		return;
	}
	directory= path.substr(0, path.find_last_of('/'));

	processNode(scene->mRootNode, scene);
}
```

首先创建一个Assimp::Importer对象，以模型文件地址作为入参。

``aiProcess_Triangulate``告诉Assimp，如果模型不是（全部）由三角形组成，它需要将模型所有的图元形状变换为三角形.

``aiProcess_FlipUVs``将在处理的时候翻转y轴的纹理坐标

``aiProcess_GenNormals``如果模型不包含法向量的话，就为每个顶点创建法线

``aiProcess_SplitLargeMeshes``将比较大的网格分割成更小的子网格，如果你的渲染有最大顶点数限制，只能渲染较小的网格，那么它会非常有用。

``aiProcess_OptimizeMeshes``和上个选项相反，它会将多个小网格拼接为一个大的网格，减少绘制调用从而进行优化。

下面来看一下``processNode``函数。
```c++
void Model::processNode(aiNode* node, const aiScene* scene)
{
	for(unsigned i=0;i<node->mNumMeshes;++i)
	{
		aiMesh* mesh = scene->mMeshes[node->mMeshes[i]];
		meshes_.emplace_back(processMesh(mesh,scene));
	}

	for (unsigned int i = 0; i < node->mNumChildren; ++i)
	{
		processNode(node->mChildren[i], scene);
	}
 }
```
这时一个递归函数，逐层处理，将Mesh存放到容器中。

下面是具体处理Mesh和Material的函数。
```c++
//处理Mesh
Mesh Model::processMesh(aiMesh* mesh, const aiScene* scene)
{
	std::vector<Vertex>vertices;
	std::vector<unsigned int>indices;
	std::vector<Texture>textures;

	for (unsigned int i = 0; i < mesh->mNumVertices; ++i)
	{
		Vertex vertex;
		glm::vec3 vec;
		///顶点位置
		vec.x = mesh->mVertices[i].x;
		vec.y = mesh->mVertices[i].y;
		vec.z = mesh->mVertices[i].z;
		vertex.position = vec;

		///顶点法向量
		if (mesh->HasNormals())
		{
			vec.x = mesh->mNormals[i].x;
			vec.y = mesh->mNormals[i].y;
			vec.z = mesh->mNormals[i].z;
			vertex.normal = vec;
		}

		///顶点贴图索引
		if (mesh->mTextureCoords[0])
		{
			glm::vec2 vec2;
			vec2.x = mesh->mTextureCoords[0][i].x;
			vec2.y = mesh->mTextureCoords[0][i].y;
			vertex.texCoords = vec2;
		}
		vertices.emplace_back(vertex);
	}

	for(unsigned int i=0;i<mesh->mNumFaces;++i)
	{
		const aiFace& face = mesh->mFaces[i];
		for (unsigned int j = 0; j < face.mNumIndices; ++j)
		{
			indices.emplace_back(face.mIndices[j]);
		}
	}
    //处理材质文件
	if (mesh->mMaterialIndex > 0)
	{
		aiMaterial* material = scene->mMaterials[mesh->mMaterialIndex];

        //存储diffuse纹理
		std::vector<Texture>diffuseMaps = loadMaterialTextures(material, aiTextureType_DIFFUSE, "texture_diffuse");
		textures.insert(textures.end(), diffuseMaps.begin(), diffuseMaps.end());
        //存储specular纹理
		std::vector<Texture>specularMaps = loadMaterialTextures(material, aiTextureType_SPECULAR, "texture_specular");
		textures.insert(textures.end(), specularMaps.begin(), specularMaps.end());
	}
	return Mesh(vertices, indices, textures);
}

std::vector<Texture> Model::loadMaterialTextures(aiMaterial* mat, aiTextureType type, std::string typeName)
{
	std::vector<Texture>textures;

	for(unsigned int i=0;i<mat->GetTextureCount(type);++i)
	{
		aiString str;
        //得到对应的纹理名称
		mat->GetTexture(type, i, &str);
        //将纹理放入容器中
		bool skip = false;
		for(int i=0;i<loadTextures_.size();++i)
		{
			if(std::strcmp(loadTextures_[i].path.C_Str(),str.C_Str())==0)
			{
				textures.push_back(loadTextures_[i]);
				skip = true;
				break;
			}
		}
		if(skip)
			continue;
        //将纹理存储到textures，并设置纹理唯一id
		Texture texture;
		texture.id = TexturefromFile(str.C_Str(), directory.c_str());
		texture.type = typeName;
		texture.path = str;
		textures.emplace_back(texture);
	}
	return textures;
}

unsigned int Model::TexturefromFile(const char* path, const char* directory)
{
	const std::string p = path;
	const std::string d = directory;
	const std::string texturePath = d + "/" + p;
	unsigned int textureId;
	MyShader::loadTexture(texturePath, textureId);
	return textureId;
}
```

通过这些函数，我们就可以实现大部分3d模型结构的加载了。


