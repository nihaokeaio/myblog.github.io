---
title: Cpp-CRTP
date: 2026-03-23 17:40:44
categories:
    - Cpp
tags:
    - Cpp
---
## 类内部返回自己的智能指针问题
直接看代码
```c++
struct Foo{
    std::shared_ptr<Foo> DoSomething() {
        std::shared_ptr p(this);///error,会让this指针被析构两次
        m_Event(p);
    }
    std::function<void(std::shared_ptr<Foo>)> m_Event;
};
```

当前存在这样一个类，需要在函数内部返回自己的智能指针时，直接将this指针赋值给智能指针是不对，这样对象会被析构两次，这时，需要让类继承,就可以安全的返回自己的智能指针!

```c++ 
struct Foo: std::enable_shared_from_this<Foo>{
    std::shared_ptr<Foo> DoSomething() {
        m_Event(Self<Foo>());
    }

    template<typename T>
    std::shared_ptr<T> Self() {
    return std::static_pointer_cast<T>(shared_from_this());
    }
    std::function<void(std::shared_ptr<Foo>)> m_Event;
};
```


## CRTP (Curiously Recurring Template Pattern) 奇异递归模板模式
子类把自己类型作为模板参数传给父类，实现静态多态、接口复用或编译期行为控制

主要用途：
1. 静态多态

与动态多态（虚函数）不同，CRTP在编译期就确定了调用关系，没有运行时开销
```c++
#include <iostream>
#include <vector>

template <typename Derived>
class Shape {
public:
    void printInfo() const {
        const Derived* derived = static_cast<const Derived*>(this);
        std::cout << "Area: " << derived->area() 
                  << ", Perimeter: " << derived->perimeter() << std::endl;
    }
};

class Circle : public Shape<Circle> {
    double r;
public:
    Circle(double radius) : r(radius) {}
    double area() const { return 3.14159 * r * r; }
    double perimeter() const { return 2 * 3.14159 * r; }
};

class Square : public Shape<Square> {
    double s;
public:
    Square(double side) : s(side) {}
    double area() const { return s * s; }
    double perimeter() const { return 4 * s; }
};

int main() {
    std::vector<Shape<Circle>> circles = { Circle(1.0), Circle(2.0) };
    std::vector<Shape<Square>> squares = { Square(1.0), Square(2.0) };

    for (const auto& c : circles) c.printInfo(); 
    // 输出: Area: 3.14159, Perimeter: 6.28318
    //       Area: 12.5664, Perimeter: 12.5664
    
    for (const auto& s : squares) s.printInfo();
    // 输出: Area: 1, Perimeter: 4
    //       Area: 4, Perimeter: 8
}
```

2. 添加功能到派生类

基类可以为派生类提供额外功能，同时能访问派生类的成员
```c++
#include <iostream>

template <typename Derived>
class Counter {
    static inline int count = 0;  // C++17起可以用inline初始化
protected:
    Counter() { ++count; }
    ~Counter() { --count; }
public:
    static int getCount() { return count; }
};

class Widget : public Counter<Widget> {};
class Gadget : public Counter<Gadget> {};

int main() {
    Widget w1, w2;
    Gadget g1;
    
    std::cout << "Widgets: " << Widget::getCount() << "\n";  // 输出: 2
    std::cout << "Gadgets: " << Gadget::getCount() << "\n";  // 输出: 1
    
    {
        Widget w3;
        std::cout << "Widgets: " << Widget::getCount() << "\n";  // 输出: 3
    }
    std::cout << "Widgets: " << Widget::getCount() << "\n";  // 输出: 2
}
```

3. 接口注入

可以给派生类注入通用接口实现(也就是前面的返回自己的智能指针)

```c++
#include <memory>
#include <iostream>

class Good : public std::enable_shared_from_this<Good> {
public:
    std::shared_ptr<Good> getptr() {
        return shared_from_this();
    }
};

class Bad {
public:
    std::shared_ptr<Bad> getptr() {
        return std::shared_ptr<Bad>(this);  // 危险！
    }
    ~Bad() { std::cout << "Bad destroyed\n"; }
};

int main() {
    // 正确用法
    std::shared_ptr<Good> gp1 = std::make_shared<Good>();
    std::shared_ptr<Good> gp2 = gp1->getptr();
    std::cout << "gp2.use_count() = " << gp2.use_count() << "\n";  // 输出: 2

    // 错误用法会导致双重释放
    std::shared_ptr<Bad> bp1 = std::make_shared<Bad>();
    std::shared_ptr<Bad> bp2 = bp1->getptr();  // 运行时错误！
    std::cout << "bp2.use_count() = " << bp2.use_count() << "\n";  // 不会执行到这里
}
```

## 协变、不变、逆变

### 不变（Invariant）

最严格，子类型关系不能传播

如果 B 是 A 子类，那么 ``Container<B>`` 不是 ``Container<A>``

常见于 C++ 模板或 STL 容器
```c++
struct A {};
struct B : A {};

std::vector<B> vb;
std::vector<A> va = vb; // ❌ 错误，不变
```

### 协变（Covariant）

返回值类型可以协变

子类方法可以返回父类返回值的子类型

```c++
struct A {};
struct B : A {};

struct Base {
    virtual ~Base()=default;
    virtual A* f() { return nullptr; }
};

struct Derived : Base {
    B* f() override { return nullptr; } // ✅ 重写基类函数，返回值为子类，协变
};

///使用,可以避免使用dynamic_cast
Derived* derived=new Derived();
B* d=derived->f();

```



### 逆变（Contravariant）

参数类型可以逆变

子类方法接受的参数类型可以“向上”扩展（父类）
```c++
struct A {};
struct B : A {};

struct Base {
    virtual void f(B* b) {}
};

struct Derived : Base {
    void f(A* a) override {} // ❌ C++ 不允许参数逆变
}
```