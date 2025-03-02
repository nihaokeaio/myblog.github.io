---
title: nlohmann-json使用
date: 2024-07-04 11:15:44
tags: json解析
categories: 
- CPP 
- json解析
---

# nlohmann使用

## 1. 引言
* nlohmann 是一个用于解析 JSON 的开源 C++ 库

## 2. 使用

### 头文件

```c++
#include "nlohmann/json.hpp"
```

通常也会直接解引用

```c++
using json = nlohmann::json;
```

常见的使用手法详见  [常见json的使用方法](https://www.cnblogs.com/linuxAndMcu/p/14503341.html)

## 3.自定义类型的转换

比如定义如下的结构体

```C++
# --foo.cpp
struct OrderMesh
{
    int x;
    std::vector<int> vec;
    Matrix mat;
};
```
对于自定义类型，nlohmann可以直接解析，但是对于矩阵类型，nlohmann没有现成的方式来解析他，所以我们需要自己写一个解析方式来告诉它应该如何解析。


```c++
#--jsonPrarse.h

namespace core
{
    template <typename T>
    struct adl_serializer<core::Point3<T>> {

    //解析json到结构体
	template <typename T>
    //解析Point4<T>类型
    struct adl_serializer<core::Point4<T>> {
	static core::Point4<T> from_json(const json& j) {
		core::Point4<T> p(j["value0"], j["value1"], j["value2"], j["value3"]);
		return std::move(p);
	}
	static void to_json(json& j, const core::Point4<T>& u) {
		j["value0"] = u.X();
		j["value1"] = u.Y();
		j["value2"] = u.Z();
		j["value3"] = u.W();
	}
    };

    template <typename T>
    struct adl_serializer<core::Matrix44<T>> {
	static core::Matrix44<T> from_json(const json& j) {
		core::Matrix44<T> mat;
		core::Point4<T> v0, v1, v2, v3;
		v0 = j.value("value0", v0);
		v1 = j.value("value1", v1);
		v2 = j.value("value2", v2);
		v3 = j.value("value3", v3);
		mat.SetColumn(0, v0);
		mat.SetColumn(1, v1);
		mat.SetColumn(2, v2);
		mat.SetColumn(3, v3);

		return std::move(mat);
	}
    //这里要先解析Point4<T>类型
	static void to_json(json& j, const core::Matrix44<T>& u) {
		core::Point4<T> v0 = u.GetColumn4(0);
		core::Point4<T> v1 = u.GetColumn4(1);
		core::Point4<T> v2 = u.GetColumn4(2);
		core::Point4<T> v3 = u.GetColumn4(3);
		j["value0"] = v0;
		j["value1"] = v1;
		j["value2"] = v2;
		j["value3"] = v3;
	}
    };
}
```
其中，``adl_serializer``的使用说明详见：[adl_serializer使用说明](https://json.nlohmann.me/api/adl_serializer/)

最后，再```foo.cpp```中引入头文件```jsonPrarse.h```就可以实现解析操作

* 使用方法为：
```C++
#include <jsonPrarse.h>
#include "CoefficientInfo.h"
class Coefficient
{
public:
	static void parseConfigCoefficient(const std::string& path, CoefficientInfo& coefficientInfo)
    {
        JsonParse<CoefficientInfo>::fromJson(path, coefficientInfo);
    }
};
```
就可以将path路径下的json文件解析到coefficientInfo成员变量中

## 4.使用宏扩展

再结构体内部使用宏```NLOHMANN_DEFINE_TYPE_INTRUSIVE_WITH_DEFAULT```就可以构造```from_json ```和 ``to_json```两个函数，用法如下：

```c++
struct OrderMeshEx
{
	int x;
    std::vector<int> vec;
    Matrix mat;
	NLOHMANN_DEFINE_TYPE_INTRUSIVE_WITH_DEFAULT(OrderMeshEx, x,vec,mat)
};
```
注意对于自定义类型，还是需要自己写构造方式和解析方式，也即映入头文件```jsonPrarse.h```。

具体宏的其实使用手法参见：[宏说明](https://json.nlohmann.me/features/arbitrary_types/#simplify-your-life-with-macros)

## 5.继承，组合使用

有时候我们需要在别人的结构体上添加字段，但是又没有别人的源码（或者无法修改），此时可以考虑使用类继承的方式构造

拿前宏的案例来说明：
```C++
struct DataInfo
{
	std::vector<int> nums;
	float val;
};

void to_json(nlohmann::json& j, const DataInfo& d) {
	j["val"] = d.val;
	for (int i = 0; i < d.nums.size(); ++i)
	{
		j["nums"][i] = d.nums[i];
	}
}

void from_json(const nlohmann::json& j, DataInfo& d) {
	d.val = j["val"];
	for (int i = 0; i < d.nums.size(); ++i)
	{
		d.nums[i] = j["nums"][i];
	}
}

struct A 
{
	double Aa;
	double Ab;
	NLOHMANN_DEFINE_TYPE_INTRUSIVE_WITH_DEFAULT(A, Aa, Ab);
};

struct B : public A 
{
	int Ba;
	int Bb;
	DataInfo Bc;
	NLOHMANN_DEFINE_TYPE_INTRUSIVE_WITH_DEFAULT(B, Aa, Ab, Ba, Bb, Bc);
};
```
此处，我们使用了B类，并继承类A，然后添加了三个成员变量，其中一个为自定义类型。
若只是添加普通类型，则直接使用默认宏就行。但是对于*自定义类型*，我们需要编写解析方式。且位于**使用宏之前**。