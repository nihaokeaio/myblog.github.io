---
title: cpp模板学习
date: 2026-09-01 11:21:11
categories:
    - Cpp
tags:
    - Cpp
---

# Modern C++ 模板学习记录

## 这份文档的目的

模板并不是日常每段业务代码都会使用的功能，但一旦需要编写通用组件、约束接口或理解标准库实现，相关知识往往会集中出现。它的难点也不只是语法多，而是类型推导、表达式值类别、重载决议和模板实例化会同时发生。

这个分支采用“小例子 + 编译期断言 + GoogleTest”的方式学习模板。代码没有试图实现一套完整的模板库，而是通过 `Version1` 到 `Version8` 逐步建立一条主线：

1. 先看清模板参数是怎样推导出来的；
2. 再理解引用折叠、移动和完美转发；
3. 用类模板、特化和类型萃取操作类型；
4. 用 concept/requires 表达模板接口；
5. 用参数包、tuple 和索引序列处理多个异构类型；
6. 最后通过 `FunctionTraits` 把前面的知识组合起来。

对应代码位于 [`test/ModernTemplateTest.cpp`](../test/ModernTemplateTest.cpp)。

## 学习路线与版本演进

| 版本 | 主题 | 主要内容 | 最重要的结论 |
| --- | --- | --- | --- |
| Version1 | 模板参数推导 | `T`、`T&`、`T&&`，左值与右值 | 参数类型、模板参数 `T`、表达式值类别需要分开判断 |
| Version2 | 移动与完美转发 | `std::move`、`std::forward`、复制/移动构造 | 具名变量是左值；`move` 无条件转为右值，`forward` 按 `T` 恢复调用方值类别 |
| Version3 | 类模板 | 主模板、全特化、指针偏特化、`if constexpr` | 特化改变类型级实现，`if constexpr` 改变单个实现内部的编译期分支 |
| Version4 | 类型萃取 | `remove_reference`、`remove_cv`、`remove_cvref`、`is_pointer` | 萃取可以通过特化识别类型，并通过继承和组合复用结果 |
| Version5 | Concepts | concept、requires-expression、返回类型约束、约束排序 | 约束描述模板所需能力，并让错误尽早出现在接口边界 |
| Version6 | 参数包 | `sizeof...`、包展开、左右折叠、参数包约束 | 展开位置决定生成的语法；不可交换运算尤其要区分左右折叠 |
| Version7 | Tuple 展开 | `index_sequence`、`tuple_size`、`forEach`、`apply` | `index_sequence` 把 tuple 的编译期索引变成可展开的参数包 |
| Version8 | FunctionTraits | 函数、函数指针、成员函数、lambda、`noexcept` | 先把各种可调用类型归一化到 `R(Args...)`，再复用共同信息 |

## Version1：从模板推导和引用开始

这一阶段比较了三种接口：

```cpp
template<typename T>
void fooByValue(T value);

template<typename T>
void fooByLValueRef(T& value);

template<typename T>
void fooByForwardingRef(T&& value);
```

### 按值传递 `T value`

按值传递会创建一个新的形参对象。模板推导通常会忽略实参的引用和顶层 `const`：

```cpp
int value = 0;
const int constValue = 0;

fooByValue(value);       // T = int
fooByValue(constValue);  // T = int
fooByValue(1);           // T = int
```

因此，按值接口适合“函数只需要一个自己的值”的场景，但无法仅通过 `T` 保留调用方的引用和值类别信息。

### 左值引用 `T& value`

普通 `T&` 主要接收左值。推导时，引用属于形参形式，`T` 本身通常推导为被引用的对象类型：

```cpp
int value = 0;
const int constValue = 0;

fooByLValueRef(value);       // T = int，形参为 int&
fooByLValueRef(constValue);  // T = const int，形参为 const int&
```

需要注意，`const T&` 可以绑定右值。因此，当模板最终形成 `const int&` 时，某些右值调用仍可能合法；判断能否调用应该看替换完成后的完整形参类型，而不是只看函数名里是否写了“左值引用”。

### 转发引用 `T&& value`

当 `T` 由调用实参推导，并且形参正好是 `T&&` 时，它是转发引用：

```cpp
int value = 0;
const int constValue = 0;

fooByForwardingRef(value);            // T = int&，形参折叠为 int&
fooByForwardingRef(constValue);       // T = const int&，形参折叠为 const int&
fooByForwardingRef(1);                // T = int，形参为 int&&
fooByForwardingRef(std::move(value)); // T = int，形参为 int&&
```

引用折叠规则可以压缩成一句话：只要组合中出现左值引用，结果就是左值引用；只有 `&&` 与 `&&` 组合时结果才是右值引用。

```text
&  + &  -> &
&  + && -> &
&& + &  -> &
&& + && -> &&
```

这里还需要始终区分三件事：

- 模板参数 `T`；
- `decltype(value)` 得到的形参声明类型；
- 表达式 `value` 的值类别。

即使 `decltype(value)` 是 `T&&`，具名表达式 `value` 本身仍然是左值。

## Version2：`std::move` 与 `std::forward`

这一阶段通过复制构造和移动构造的输出，对比了三种传递方式：

```cpp
consume(value);
consume(std::move(value));
consume(std::forward<T>(value));
```

核心区别如下：

- 直接使用具名形参 `value`：表达式是左值；
- `std::move(value)`：无条件将表达式转换为右值；
- `std::forward<T>(value)`：根据模板参数 `T` 有条件地恢复调用方的值类别。

`std::forward<T>(value)` 可以建立下面这个心智模型：

```cpp
static_cast<T&&>(value)
```

若调用方传入左值，则 `T` 推导为 `U&`，经过引用折叠后仍是 `U&`；若传入右值，则 `T` 推导为 `U`，结果为 `U&&`。这正是完美转发能够保持调用方值类别的原因。

`std::move` 本身不移动任何对象，它只是一次类型转换。真正的移动发生在后续重载决议选择了移动构造、移动赋值或接收右值引用的函数之后。

## Version3：类模板、特化与编译期分支

`ValueHolder<T>` 依次实现了：

- 通用的主模板；
- 针对 `int` 的全特化；
- 针对 `U*` 的偏特化；
- 主模板内部针对 `double` 的 `if constexpr` 分支。

这几种技术的作用层次不同：

- 全特化用于给某一个确定类型提供完整的替代实现；
- 偏特化用于匹配一类具有共同形状的类型，例如所有指针；
- `if constexpr` 用于在同一份模板实现内部选择可在编译期丢弃的代码分支。

类模板实参推导（CTAD）也在这里得到验证，例如由构造参数推导出 `ValueHolder<int>`。

## Version4：自己实现类型萃取

这一阶段实现了以下工具：

```cpp
MyRemoveReferenceT<T>
MyRemoveCVT<T>
MyRemoveCVRefT<T>
MyIsPointerV<T>
```

类型萃取的常见结构是：

1. 主模板给出默认答案；
2. 偏特化匹配需要特殊处理的类型形状；
3. 别名模板暴露结果类型；
4. 变量模板暴露结果值。

例如，`MyIsPointerImpl<T>` 默认继承 `std::false_type`，而 `MyIsPointerImpl<T*>` 继承 `std::true_type`。继承后，派生类自然拥有基类中的 `value`、`value_type` 和转换运算符，因此不必重复声明。

组合能够减少特化数量。`MyIsPointer<T>` 先用 `MyRemoveCVT<T>` 去掉指针变量自身的顶层 cv，再交给 `MyIsPointerImpl` 判断，从而不必分别实现 `T* const`、`T* volatile` 和 `T* const volatile`。

这里要特别区分：

- 顶层 const：修饰变量本身，例如 `int* const`；
- 底层 const：修饰指向的对象，例如 `const int*`。

`remove_cv` 只移除顶层 cv，不会把 `const int*` 变成 `int*`。

## Version5：用 concept 和 requires 描述接口

这一阶段没有继续依赖复杂的替换失败技巧，而是用 C++20 concepts 直接表达模板需求：

```cpp
template<typename T>
concept Dereferenceable = requires(T&& value) {
    *value;
};
```

随后组合出了 `PointerType`、`HasConstGet` 和 `GetReturnsConstIntRef`，分别验证：

- 类型是否为可解引用的指针；
- const 对象是否存在 `Get()`；
- `Get()` 的返回类型是否正好是 `const int&`。

约束不仅决定“能不能调用”，还参与重载排序。更严格的概念最好通过较宽松的概念组合出来，这样编译器可以识别包含关系，并选择约束更强的重载。

concept 只影响编译期可用性和重载决议，不会为运行期增加额外判断成本。

## Version6：参数包与折叠表达式

这一阶段覆盖了：

- `sizeof...(Args)` 获取参数数量；
- 在函数调用和表达式中展开参数包；
- 逗号折叠依次执行操作；
- 一元、二元、左折叠和右折叠；
- 对参数包中的每个类型施加 concept。

对加法这类满足结合律的运算，左右折叠往往不容易看出差异；减法测试则清晰展示了结合方向：

```text
二元左折叠：(0 - 10) - 3 - 2 = -15
二元右折叠：10 - (3 - (2 - 0)) = 9
```

因此看到折叠表达式时，应先确定省略号的位置，再写出少量参数的展开结果，不要仅凭“从左到右阅读”判断。

## Version7：tuple、索引序列与逐元素调用

`std::tuple` 的元素类型不同，无法用普通运行期循环统一访问。`std::index_sequence` 的作用是生成编译期索引包：

```cpp
std::index_sequence_for<Ts...>{}       // 0 到 sizeof...(Ts) - 1
std::make_index_sequence<N>{}          // 0 到 N - 1
```

然后通过 `std::get<Index>(tuple)...` 在模板中展开所有元素。

`std::tuple_size_v` 接收的是一个完整的 tuple-like 类型，而不是裸露的类型参数包：

```cpp
std::tuple_size_v<std::tuple<Ts...>> // 正确
// std::tuple_size_v<Ts...>          // 错误
```

`TupleForEach` 还处理了一个很有代表性的需求：某个操作只对 tuple 中的部分元素合法。做法不是让一次不满足约束的调用破坏整个展开，而是在逐元素辅助调用中使用 `if constexpr` 和 `std::is_invocable_v`，仅实例化可调用的分支。

`TupleApply` 则把 tuple 的所有元素一次性展开为某个可调用对象的参数，并用 `decltype(auto)` 保留调用结果的准确类型。

## Version8：FunctionTraits 与可调用类型归一化

最终版本提取可调用对象的：

- `ReturnType`；
- `ArgumentTuple`；
- `ArgumentCount`；
- 第 `I` 个参数 `Argument<I>`；
- 成员函数所属的 `ClassType`；
- `IsNoexcept`。

实现的关键不是为每一种可调用类型重复保存这些信息，而是把它们归一化到核心形式：

```cpp
FunctionTraits<R(Args...)>
```

函数指针和成员函数指针的偏特化继承核心实现，只补充自身特有的信息。普通函数对象和非泛型 lambda 则通过 `decltype(&T::operator())` 转换为成员函数指针形式。

### 重载函数对象

如果 `operator()` 存在重载，`&T::operator()` 没有唯一结果，必须先显式选择签名：

```cpp
using Operator = decltype(
    static_cast<double (Multiplier::*)(
        int, const std::string&, float
    ) const>(&Multiplier::operator())
);

using Traits = FunctionTraits<Operator>;
```

### 泛型 lambda

泛型 lambda 的 `operator()` 是函数模板，同样不存在唯一签名。需要先选择某次模板实例化：

```cpp
using Lambda = decltype(templateLambda);
using IntOperator = decltype(&Lambda::operator()<int>);
using Traits = FunctionTraits<IntOperator>;
```

这也说明 `FunctionTraits` 并非对所有可调用对象都能自动得到唯一答案。实际工程中，如果只关心某组参数能否调用以及调用结果，通常优先使用：

```cpp
std::invocable<F, Args...>
std::invoke_result_t<F, Args...>
```

只有确实需要拆解固定函数签名时，才使用类似 `FunctionTraits` 的工具。

## 学习过程中形成的几个判断方法

### 1. 分三层判断类型问题

遇到引用和转发问题时，依次写出：

1. 实参表达式的类型和值类别；
2. 模板参数 `T` 的推导结果；
3. 替换并引用折叠后的形参类型。

最后再判断函数体内具名形参表达式的值类别。这个过程比直接记忆某个例子的答案更可靠。

### 2. 先找第一条模板实例化错误

模板报错经常形成很长的连锁信息。应优先寻找：

- 最早的模板实例化上下文；
- 第一次出现“无法选择重载”“约束不满足”或“类型不存在”的位置；
- 自己的代码中最靠近调用点的那一行。

后续大量“成员不存在”往往只是第一个错误造成的结果。

### 3. 编译期结论优先用 `static_assert`

类型是否相同、concept 是否满足以及萃取结果都属于编译期事实，适合使用 `static_assert`。GoogleTest 的 `EXPECT_*` 更适合检查运行期行为。两者结合，可以让示例同时成为可执行文档和回归测试。

### 4. 能组合就少写重复特化

类型萃取和 traits 的价值不仅是“识别类型”，还在于将小规则组合为更大的规则。继承已有 traits、使用别名模板、先规范化类型再分类，通常比复制多份偏特化更容易维护。

## 当前能力边界

完成这些版本后，已经能够处理多数应用层模板需求，包括：

- 阅读和编写常见函数模板、类模板；
- 编写受约束的通用接口；
- 正确转发参数；
- 实现简单类型萃取；
- 处理参数包和 tuple-like 数据；
- 对固定签名的可调用对象做编译期分析；
- 根据编译器实例化信息定位常见模板错误。

仍然可能需要按实际需求继续补充的内容包括：

- 非类型模板参数；
- 类模板实参推导指引；
- 依赖名称中的 `typename` 和 `template`；
- 显式实例化、模板定义的可见性和 ODR；
- 成员函数的 `volatile`、`&`、`&&` 限定；
- 更复杂的 SFINAE、concept subsumption 和标准库 ranges；
- 模板带来的编译时间、错误信息和代码膨胀问题。

这些内容不需要为了“补齐语法”集中学习。当前基础已经足以在真实需求出现时继续向下探索。

## 可选的综合练习

如果希望再做一次小型实战，可以实现一个约 100～200 行的：

```cpp
CallbackList<void(int, const std::string&)>
```

它可以包含 `connect`、`disconnect` 和 `emit`，并自然复用：

- `CallbackList<R(Args...)>` 偏特化；
- `std::invocable` 约束；
- 参数包；
- 完美转发；
- `std::invoke`；
- lambda、函数对象和普通函数。

这项练习是可选的。没有真实需求时，不必继续构造更复杂的模板框架；保留当前测试作为“模板母题”，以后遇到项目问题时回来增加一个最小示例，往往是更有效的长期学习方式。

## 构建与运行

模板测试目标使用 C++23 和 GoogleTest。首次配置时需要允许 CMake 获取 GoogleTest：

```powershell
cmake -S . -B cmake-build-debug-visual-studio -DBUILD_TESTING=ON
cmake --build cmake-build-debug-visual-studio --target ModernCPPTest --config Debug
ctest --test-dir cmake-build-debug-visual-studio -C Debug --output-on-failure
```

也可以直接运行生成的 `ModernCPPTest` 可执行文件查看类型推导、复制和移动构造等演示输出。

## 以后如何复习

不建议重新通读所有模板语法。可以保留下面这组检查题：

1. `T`、`T&`、转发引用 `T&&` 分别怎样推导？
2. 为什么具名的 `T&&` 形参表达式仍是左值？
3. `std::move` 和 `std::forward` 分别承诺了什么？
4. 主模板、全特化、偏特化和 `if constexpr` 应该如何选择？
5. 为什么 traits 可以通过继承复用 `type` 和 `value`？
6. requires-expression 检查的是类型、表达式还是返回类型？
7. 某个折叠表达式展开三个参数后具体是什么？
8. `index_sequence` 如何把 tuple 转换为参数包展开？
9. 为什么重载函数对象和泛型 lambda 需要先消歧？

如果这些问题能够结合一个小例子回答出来，主线知识就仍然是连贯的。
