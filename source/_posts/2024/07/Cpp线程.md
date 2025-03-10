---
title: Cpp线程
date: 2024-07-10 16:48:51
tags: 
    - CPP多线程
categories: 
    - Cpp 
    - 多线程
---

# <center>C++线程

## 1. 线程管控

1.1 拉起线程
    ```std::thread thread(f)```,其中，f是可调用的对象，一般就是函数，或者仿函数。注意，存在一种可能：
```C++
std::thread myFun(myTask());
std::thread myFun{ myTask() }
```
对于第一种，传入临时变量，可能会将函数调用（创建新的线程）变成了函数声明，返回值是一个线程对象，接收的参数是一个函数指针，其无传参，返回值是myTask类型。造成错误的解释。因此，可以改用列表初始化的方式初始化线程对象。此外，还可以采用lambda表达式避免这个问题。

******************

1.2 汇合线程
一般采用 detach() 和 join() 两种方法。注意前者，不要以引用方式传入临时变量，会造成线程奔溃。且必须在线程结束时调用，否则会触发线程terminate。因此，可以使用RAII机制创建线程，在析构函数处添加。

1.3 传参

```std::thread```自带存储空间，会以原样复制提供的值。所以经常会出现类型转换问题。

1）隐式转换：
```c++

void f(int i,std::string const & s);

char buf[1024];
sprintf(buf,"%i",param);
std::thread t(f,3,buf);
```
此处，buf转换成string对象时，线程可能已经退出，导致局部数组销毁，出现未定义行为。解决办法->```std::thread t(f,3,std::string(buf));```，显示传入参数。

2) 引用传参

同理，可以使用```std::ref() ```,使其引用传参





