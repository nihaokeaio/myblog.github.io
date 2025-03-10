---
title: C++函数调用
date: 2025-03-05 10:07:40
categories:
    - Cpp
    - 基础知识
tags:
    - Cpp函数调用
---

## C++函数调用（回调）

假设我们有一下的通用函数
```c++
namespace space00
{
	class A
	{
	public:
        //类成员函数
		void get2x(int x)
		{
			cout << "x = " << 2*x << endl;
		}
        //类虚函数
		virtual void get4x(int x)
		{
			cout << "x = " << 4*x << endl;
		}
        //类静态函数
		static void get6x(int x)
		{
			cout << "x = " << 6*x << endl;
		}
        //类静态函数
		static void get6x_str(int x,string str)
		{
			cout << "x = " << 6 * x << " and string = " << str << endl;
		}
        //带返回值的类成员函数
		int add(int x, int y)
		{
			cout << "x = " << x << " y = " << y << endl;
			return x + y;
		}
        //类成员函数重载
		void add(int x, int y, int& c)
		{
			cout << "x = " << x << " y = " << y << endl;
			c = x + y;
		}
        //类静态函数
		static void transFun(int x,void* content)
		{
			(((A*)content)->get2x)(x);
		}
	};
    //普通函数
    void normFun(int x)
    {
        cout << "x = " << x << endl;
    }
}
```
那么，我们该如何进行函数回调呢？

### 第一版
```c++
class B
{
public:
	void getText(int x, void(*fun)(int))
	{
		fun(x);
	}

	void getText1(int x, void(A::*fun)(int),void* content)
	{
		//注意，这里要主动加括号
		(((A*)content)->*fun)(x);
	}
	//解耦合，通过使用静态函数转换
	void getText2(int x, void(*fun)(int,void*), void* content)
	{
		//注意，这里要主动加括号
		fun(x,content);
	}
};
```
我们构造B类对象b，那么基本的调用方式如下：
```C++
B b;
b.getText(1, space00::normFun);//普通函数
b.getText(1, space00::A::get6x);//类静态函数
b.getText1(1, &space00::A::get2x,&a);//类普通函数
b.getText1(1, &space00::A::get4x,&a);//类虚函数
b.getText2(1, space00::A::transFun,&a);//类静态函数
```

### 第二版

使用``std::function``统一接口

```c++
class C
{
	using CallBackFun = const std::function<void(int)>;
public:
	void getText(int x, CallBackFun& callbackfun)
	{
		//使用functional统一了接口，但还是有一个问题，只能针对void(int)类型的函数
		callbackfun(x);
	}
};
```
我们使用统一接口的方式调用：
```c++
C c;
c.getText(1, &space00::A::get6x);
//c.getText(1, &space00::A::get2x);//这样子肯定是不行的，还需要bind一下
c.getText(2, bind(&space00::A::get2x, &a, 1));//bind 还需要传入函数具体的参数 #2
c.getText(3, bind(&space00::A::get2x, &a, std::placeholders::_1));//std::placeholders::_1 先整一个占位符 #6
c.getText(4, bind(&space00::A::get4x, &a, std::placeholders::_1));//虚函数也没问题
c.getText(5, bind(&space00::A::get6x, std::placeholders::_1));//静态成员函数则不需要传入对象
```
需要注意传参2，3的调用，前者的结果是2，后者的结果是6

### 第三版

可以发现，我们虽然统一了接口，但是似乎只能调用void(int)类型函数啊，别的参数类型的函数该怎么调用呢？

```c++
class D
{	
public:
	template <typename Fun,typename... Arg>
	auto getText(Fun&& f, Arg&&... arg)
	{
		///*auto [obj, arg...] = arg...;*/
		//using recType = decltype(f(arg...));
		auto task = std::bind(std::forward<Fun>(f), std::forward<Arg>(arg)...);
		
		using CallBackFun = std::function<void()>;
		CallBackFun callbackfun{ task };
		callbackfun();
		using recType = decltype(callbackfun());
		auto Task = std::make_shared<std::packaged_task <recType()>>(task);
		future<recType>returnFuture = Task->get_future();
	}
};
```
```c++
D d;
d.getText(space00::A::get6x, 1);//静态函数，无需传入对象
d.getText(space00::A::get6x_str, 1, "Hello world");
d.getText(&space00::A::get2x, &a, 1);
```

可以看到，现在可以穿其他类型的参数了，支持多个参数，但是对于具有返回类型，函数重载的支持并不怎么好（不过前者可以通过传入引用的方式解决）

### 第四版

```c++
#include <functional>
#include <string>
#include <map>

class CallBackFunctor
{
public:
	static CallBackFunctor& instance();

	template<typename  Fun,typename ... Args>
	void setCallBack(std::string funName ,Fun&& f, Args&&... args);

	//template<typename RecType>
	auto execCallBackFun(std::string funName/*, RecType&& recType*/);
private:
	CallBackFunctor() = default;

	std::map < std::string, std::function<void()>> callBackList_;
};

CallBackFunctor& CallBackFunctor::instance()
{
	static CallBackFunctor gInstance;
	return gInstance;
}


auto CallBackFunctor::execCallBackFun(std::string funName)
{
	auto iter = callBackList_.find(funName);
	if (iter != callBackList_.end())
	{
		return iter->second();
	}
}

template <typename Fun, typename ... Args>
void CallBackFunctor::setCallBack(std::string funName, Fun&& f, Args&&... args)
{
	auto task = std::bind(std::forward<Fun>(f), std::forward<Args>(args)...);
	using  CallBackFun = std::function<void()>;
	CallBackFun callBackFun{ task };
	callBackList_.insert({ funName,callBackFun });
}
```

这里写了一一个函数调用的单例，这样，就可以支持通过注册函数名称，调用相应的函数了。

使用方式：
```c++
///对于类成员的重载函数，似乎使用lambda表达式更好，不然会歧义
/*int value;
CallBackFunctor::instance().setCallBack("AddFun" ,&space00::A::add, &a, 1, 2, value);
CallBackFunctor::instance().execCallBackFun("AddFun");*/

int val;
auto lambda = [&a, &val]() {a.add(2, 3, val); };
CallBackFunctor::instance().setCallBack("AddFun2", lambda);
CallBackFunctor::instance().execCallBackFun("AddFun2");
```

### 最终版

其实，前面的案例都是自己编写过程中遇到的一些问题，比较具有适用性，适合短小函数的回调。

下面我们看看网上别人的调用代码。（ps:其实我也看不太懂）

以下是代码的备份（怕他被河蟹了备份一份）

```c++
#pragma once
#include <iostream>
namespace TInvoke
{
	// member function template
	template<typename R, typename T, typename... ARGS>
	struct AnyMemberFunCall
	{
		using FunType = R(T::*)(ARGS...);
		AnyMemberFunCall(T* pkObj, FunType pfFun) :m_pkObj(pkObj), m_pfFun(pfFun) {};
		R DoInvoke(ARGS&&... args) { return (m_pkObj->*m_pfFun)(std::forward<ARGS>(args)...); };
	private:
		T* m_pkObj = nullptr;
		FunType m_pfFun = nullptr;
	};

	template<typename R, typename T, typename... ARGS>
	auto CreateAnyMemberFunCall(T* pkObj, R(T::* pkFun)(ARGS...))
		-> decltype(AnyMemberFunCall(pkObj, pkFun))
	{
		return AnyMemberFunCall(pkObj, pkFun);
	}

	// use the enable for detech
	template<bool bCheck, typename T = void>
	struct MyEnableIf {};

	template<typename T>
	struct MyEnableIf<true, T>
	{
		using Type = T;
	};

	template<typename B, typename D>
	struct IsDClassFromBClass
	{
		using B_D_T = std::decay_t<B>;
		using D_D_T = std::decay_t<D>;
		static auto Check(B_D_T*) -> int;
		static auto Check(...) -> void;
		static constexpr bool Value = !std::is_void_v<decltype(Check((D_D_T*)0))>;
		//static constexpr bool Value = !std::is_void<decltype(Check(D_D_T*)0)>::value;
	};

	template<typename B, typename D, typename MyEnableIf<IsDClassFromBClass<B, D>::Value, std::decay_t<D>>::Type* = nullptr>
	auto GetRightMemberType(D&& obj) -> decltype(static_cast<D&&>(obj))
	{
		return static_cast<D&&>(obj);
	}

	template<typename B, typename D, typename MyEnableIf<!IsDClassFromBClass<B, D>::Value, std::decay_t<D>>::Type* = nullptr>
	auto GetRightMemberType(D&& obj) -> decltype(*(static_cast<D&&>(obj)))
	{
		return *(static_cast<D&&>(obj));
	}

	template<typename F, typename... ARGS>
	auto CommonInvokeCall(F&& funObj, ARGS&&... args)
		-> decltype(std::forward<F>(funObj)(std::forward<ARGS>(args)...))
	{
		return std::forward<F>(funObj)(std::forward<ARGS>(args)...);
	}


	//member function
	template<typename R, typename T, typename C, typename... ARGS>
	auto CommonInvokeCall(R(T::* pfMem)(ARGS...), C&& obj, ARGS&&... args)
		-> decltype((GetRightMemberType<T>(std::forward<C>(obj)).*pfMem)(std::forward<ARGS>(args)...))
	{

		return (GetRightMemberType<T>(std::forward<C>(obj)).*pfMem)(std::forward<ARGS>(args)...);
	}

	template<typename R, typename T, typename C, typename... ARGS>
	auto CommonInvokeCall(R(T::* pfMem)(ARGS...) const, C&& obj, ARGS&&... args)
		-> decltype((GetRightMemberType<T>(std::forward<C>(obj)).*pfMem)(std::forward<ARGS>(args)...))
	{

		return (GetRightMemberType<T>(std::forward<C>(obj)).*pfMem)(std::forward<ARGS>(args)...);
	}

	// test class
	class BaseClassForFunCall
	{
	public:
		int BaseAddTwoNum(int a, int b)
		{
			std::cout << "baseAddTwoNum" << std::endl;
			return a + b;
		}

		virtual int AddTwoNumSum(int a, int b)
		{
			std::cout << "baseAddTwoNumSum" << std::endl;
			return a + b;
		}
	};

	class DeriveClassForFunCall :public BaseClassForFunCall
	{
	public:
		int addtwonum(int a, int b)
		{
			std::cout << "addtwonum" << std::endl;
			return a + b;
		}

		int addtwonumconst(int a, int b) const
		{
			std::cout << "const addtwonum" << std::endl;
			return a + b;
		}

		static float addtwofloatnum(float a, float b)
		{
			std::cout << "static addtwofloatnum" << std::endl;
			return a + b;
		}

		int AddTwoNumSum(int a, int b) override
		{
			std::cout << "deriveAddTwoNumSum" << std::endl;
			return a + b + 1;
		}
	};


	struct myfunctor
	{
		std::string operator()(const std::string& a, const std::string& b)
		{
			std::cout << "a string:" << a.c_str() << std::endl;
			std::cout << "b string" << b.c_str() << std::endl;
			return a + b;
		}
	};

	std::string testfun1(const std::string& a, const std::string& b)
	{
		std::cout << "a string:" << a.c_str() << std::endl;
		std::cout << "b string" << b.c_str() << std::endl;
		return a + b;
	}


	//just for the self class member 
	template<typename R, typename T, typename... ARGS>
	auto CommonInvokeCallOne(R(T::* pfMem)(ARGS...), T obj, ARGS&&... args)
		-> decltype((obj.*pfMem)(std::forward<ARGS>(args)...))
	{
		return (obj.*pfMem)(std::forward<ARGS>(args)...);
	}

	template<typename R, typename T, typename... ARGS>
	auto CommonInvokeCallOne(R(T::* pfMem)(ARGS...) const, T obj, ARGS&&... args)
		-> decltype((obj.*pfMem)(std::forward<ARGS>(args)...))
	{
		return (obj.*pfMem)(std::forward<ARGS>(args)...);
	}

	//can for base class member funciton and move 
	template<typename R, typename T, typename C, typename... ARGS>
	auto CommonInvokeCallTwo(R(T::* pfMem)(ARGS...), C&& obj, ARGS&&... args)
		-> decltype((std::forward<C>(obj).*pfMem)(std::forward<ARGS>(args)...))
	{

		return (std::forward<C>(obj).*pfMem)(std::forward<ARGS>(args)...);
	}

	template<typename R, typename T, typename C, typename... ARGS>
	auto CommonInvokeCallTwo(R(T::* pfMem)(ARGS...) const, C&& obj, ARGS&&... args)
		-> decltype((std::forward<C>(obj).*pfMem)(std::forward<ARGS>(args)...))
	{

		return (std::forward<C>(obj).*pfMem)(std::forward<ARGS>(args)...);
	}
};


static void Template_Test_Invoke()
{
	using namespace TInvoke;

	// test for common member fuction
	DeriveClassForFunCall c1;
	auto caller = CreateAnyMemberFunCall(&c1, &DeriveClassForFunCall::addtwonum);
	caller.DoInvoke(12, 15);

	// // test for common base member function
	//auto caller1 = CreateAnyMemberFunCall(&c1,&ClassForFunCall::BaseAddTwoNum); //error,can't detech
	//std::cout << caller1.DoInvoke(100,200) << std::endl;


	// test for functor
	myfunctor funobj;
	const std::string a1 = "hello ", b1 = "c++ world1";
	auto aret1 = CommonInvokeCall(funobj, "hello ", "c++ world1");
	std::cout << aret1.c_str() << std::endl;
	auto aret11 = CommonInvokeCall(funobj, a1, b1);
	std::cout << aret11.c_str() << std::endl;

	//test for lambda
	CommonInvokeCall([](const std::string& a, const std::string& b)->decltype(a + b)\
	{
		std::cout << "lambda " << a.c_str() << b.c_str() << std::endl;
		return a + b;
	}, a1, b1);

	// test for common function
	testfun1("hello ", "c++ world2");
	const std::string a = "hello ", b = "c++ world3";
	auto aret2 = CommonInvokeCall(testfun1, a, b);
	std::cout << aret2.c_str() << std::endl;


	// test for static member function
	auto aret3 = CommonInvokeCall(DeriveClassForFunCall::addtwofloatnum, 22.42f, 100.2f);
	std::cout << aret3 << std::endl;

	// test for common member function
	auto aret4 = CommonInvokeCall(&DeriveClassForFunCall::addtwonum, c1, 100, 200);
	std::cout << aret4 << std::endl;

	// test for common member function
	auto aret5 = CommonInvokeCall(&DeriveClassForFunCall::addtwonumconst, c1, 100, 300);
	std::cout << aret5 << std::endl;


	// // test for common base member function
	auto aret6 = CommonInvokeCall(&DeriveClassForFunCall::BaseAddTwoNum, c1, 100, 400);
	std::cout << aret6 << std::endl;


	DeriveClassForFunCall* pkC1 = &c1;
	auto aret7 = CommonInvokeCall(&DeriveClassForFunCall::BaseAddTwoNum, pkC1, 100, 500);
	std::cout << aret7 << std::endl;

	//test for virtual member function
	BaseClassForFunCall& pkC2 = c1;
	auto aret8 = CommonInvokeCall(&BaseClassForFunCall::AddTwoNumSum, pkC2, 100, 600);
	std::cout << aret8 << std::endl;

	// test for not compatible class
	//BaseClassForFunCall bc1;
	//auto aret8 = CommonInvokeCall(&ClassForFunCall::addtwonumconst,bc1,100,200);
	// std::cout << aret8 << std::endl;
}
```

[函数调用](https://zhuanlan.zhihu.com/p/362173165)