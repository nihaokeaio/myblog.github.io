---
title: cpp新特性
date: 2026-05-25 11:00:59
categories:
    - Cpp
tags:
    - Cpp
---
# C++的新特性（cpp20）
本文主要做一些c++新特性的汇总，但不做具体的表述

## 语言使用增强
### nullptr

### constexpr
使表达式可以在编译期执行

### if-switch
在if内定义变量使用
```c++
// since c++17, can be simplified by using `auto`
const std::vector<int>::iterator itr = std::find(vec.begin(), vec.end(), 2);
if (itr != vec.end()) {
*itr = 3;
}
if (const std::vector<int>::iterator itr = std::find(vec.begin(), vec.end(), 3);
itr != vec.end()) {
*itr = 4;
}
```

### 初始化表达式（Initializer list）
统一了C++多样的对象构造方式

### 结构化绑定
``auto [x, y, z] = f();``

### auto
万物皆可auto

### decltype
对表达式或对象进行类型推导，也可用于auto

### 尾返回方式（tail type inference）
```c++
template<typename R, typename T, typename U>
R add(T x, U y) {
return x+y;
}
//升级
template<typename T, typename U>
auto add(T x, U y)->decltype(x+y) {
return x+y;
}
//升级
template<typename T, typename U>
auto add(T x, U y){
return x+y;
}
```


### if constexpr(编译控制流)
```c++
template<typename T>
auto print_type_info(const T& t) {
if constexpr (std::is_integral<T>::value) {
    return t + 1;
} else {
    return t + 0.001;
}
}
```

### 基于范围循环

### 模板

这章可以单独出一门语言了

### 代理构造，Explicit，override, final, =default, =delete


## 语言运行增强
### Lambda表达式

### Function Object Wrapper
统一了函数指针

### 右值引用