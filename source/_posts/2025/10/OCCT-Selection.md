---
title: OCCT-Selection
date: 2025-10-13 11:38:01
categories:
    - OCCT
tags:
---

# OCCT的选择系统

## 主要对象
- AIS_InteractiveObject 
    - SelectMgr_SelectableObject的子类
- SelectMgr_EntityOwner
    - 构造时，需要传入AIS_InteractiveObject指针，保存其指针
- SelectMgr_SensitiveEntity
    - 敏感体，需要归属于一个SelectMgr_EntityOwner，其内部的Box和Matched接口用于空间加速以及射线求交，并通过EntityOwner找到AIS_InteractiveObject
- SelectMgr_SelectableObject 
- SelectBasics_SelectingVolumeManager
    - 管理选择体积，如点选射线，框选视锥体
- AIS_InteractiveContext
    - 交互上下文，鼠标移动触发SSelect接口，内部调用Pick
- SelectMgr_ViewerSelector 
    - 全局选择管理器，遍历可选择对象（SelectMgr_SelectableObjectSet），使用bvh加速结构
    - 调用SelectBasics_SelectingVolumeManager进行Pick操作

### 流程梳理
1. 用户点击屏幕：

    AIS_InteractiveContext::Select() 被调用，触发 SelectMgr_ViewerSelector::Pick()

2. 构建选择体积：

    SelectBasics_SelectingVolumeManager 将鼠标坐标转换为 3D 选择体积（如射线）

3. BVH 加速查询：

    SelectMgr_ViewerSelector 遍历 BVH 树，快速筛选可能命中的 SelectMgr_SelectableObject。

4. 精确碰撞检测：

    对候选对象调用其 SelectMgr_SensitiveEntity::Matches()，检测几何相交。

5. 结果处理
    命中结果通过 SelectMgr_EntityOwner 传递到 AIS_InteractiveObject，触发高亮或回调。
    例如：SelectMgr_EntityOwner的HilightWithColor。当SelectMgr_SelectableObject::IsAutoHilight()是false时（默认未ture），高亮以及相关的显示工作会重定向到交互对象本身 SelectMgr_SelectableObject::HilightSelected()

