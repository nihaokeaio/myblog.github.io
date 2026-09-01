---
title: DependencyGraph
date: 2026-06-22 11:11:30
categories:
    - Cpp
tags:
    - Cpp
---

## DependencyGraph(依赖图设计)

### 背景
依赖图的核心，本质上是为了应对复杂系统中“牵一发而动全身” 的困境而生的。

举几个比较常规的例子：
在网络拓扑结构中，常常会出现我移动一个点，别的点应该出现联动的逻辑，比如骨骼动画中，我移动一个关节，别的点位也应该出现移动。

仿真软件中，比如一个简单的阻抗模拟电路，导线中的电流会随着阻抗的变化而变化，这些都是依赖图的一个应用场景。

因此，本文以UE5蓝图或者comfyui的节点设计为样式展开学习。

### 代码结构

本仓库的代码核心是core目录下的代码部分，主要包含了以下几个部分：简单的属性系统，依赖图上下文，执行器，节点访问器，计算节点，随机数生成部分。

#### 属性系统
属性值使用了PropertyValue的类来设计，其内部是一个std::variant的成员，用于装填简单的数据对象，此外还封装了相应的读取，写入结构。ValueHandle 是依赖图内部的数据节点，它持有一组属性值；外部对象绑定则由 Binding 层预留，其核心就是一个``std::unordered_map<std::string, PropertyValue> properties;``的容器，通过字符串方式映射写入属性，valueId则是该对象（ValueHandle）在依赖图上下文（DGContext）中的标识标号。

#### 依赖图上下文（DGContext）
核心管理器对象，增删改查的逻辑都在此。核心成员变量持有了所有数据节点``ValueHandle``以及计算节点``ComputerNode``，通过id的方式进行访问。此外，它还持有了执行器``GraphExecutor``，也是外部触发执行的入口。此外，在创建计算节点时会执行环检。

#### 执行器（GraphExecutor）
依赖图的核心部分，实现了增添与删除逻辑。执行器在执行时，利用广度优先的方式，收集所有dirty的计算节点，然后再执行相应的节点计算，得到输出节点，然后开启第二轮迭代。过程中包含了数值节点，计算节点去重以减少不必要的重复计算，还通过拓扑排序保证了计算节点的先后顺序（如果同一批中存在 A 节点输出被 B 节点读取，则必须保证 A 先于 B 执行，否则 B 可能读到旧数据。），保证计算时数据一定是最新的。此外还包含了一些日志逻辑

#### Dirty传播流程
输入 value 被修改 -> MarkDirty -> 查找依赖它的 ComputerNode -> 执行节点 -> 输出 value 继续 dirty -> 直到没有下游节点

### 项目的仓库位置
[DependencyGraph](https://github.com/nihaokeaio/OCCTLearning/tree/DependencyGraph)