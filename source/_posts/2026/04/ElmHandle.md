---
title: ElmHandle
date: 2026-04-13 10:30:30
categories:
    - Cpp
tags:
    - Cpp
---

## ElmHandle的使用
- 问题溯源

    对于shared_ptr,我们可以使用weak_ptr来探测其生命周期是否已经消亡，但是对于unique_ptr，从设计便不存在相应的探测器，因而经常会出现悬空指针问题。

- 举例

    比如，若有一个总的Manger管理所有对象，也就是说其有个容器持有所有对象的unique_ptr，此外外部使用对象的裸指针进行操作。但当容器中的对象被析构时，外部裸指针往往无法感应到，导致出现使用悬空指针的问题！

- 处理方式

    我们加入一个中间层，用来检测其悬空指针的使用情况

直接给出实例代码
```c++
namespace MyTest
{
    class ControlBlock;
    //对象OBJ
    class Object
    {
    public:
        explicit Object(int id) : m_Id(id)
        {
        }

    public:
        void DoSomething()
        {
            std::cout << "Hello,ObjectId =" << m_Id << std::endl;
        }

    public:
        //持有控制模块的裸指针
        ControlBlock* m_ControlBlock = nullptr;
        int m_Id;
    };

    //控制模块对象
    class ControlBlock
    {
    public:
        Object* m_Object;   //对象裸指针
        int m_RefCount;     //引用计数
        bool m_IsRegister;  //注册计数
    };

    //Handle指针，外部调用使用该指针
    class ElmHandle
    {
    public:
        ElmHandle() = delete;

        explicit ElmHandle(ControlBlock* controlBlock) : m_ControlBlock(controlBlock)
        {
            assert(controlBlock==nullptr);
            Inc();
        }

        ElmHandle(const ElmHandle&& elm) noexcept
        {
            m_ControlBlock = elm.m_ControlBlock;
            Inc();
        }

        ElmHandle(const ElmHandle& elm) noexcept
        {
            m_ControlBlock = elm.m_ControlBlock;
            Inc();
        }

        ~ElmHandle()
        {
            Dec();
            //析构时，若引用计数为零，真正的删除对象
            if (m_ControlBlock->m_RefCount == 0)
            {
                delete m_ControlBlock->m_Object;
                delete m_ControlBlock;
            }
        }

        void Inc()
        {
            ++m_ControlBlock->m_RefCount;
        }

        void Dec()
        {
            --m_ControlBlock->m_RefCount;
        }

        //通过bool来判断对象是否还可用
        bool IsExpired() const
        {
            return !m_ControlBlock->m_IsRegister;
        }

        void DoSomething() const
        {
            if (!IsExpired())
            {
                m_ControlBlock->m_Object->DoSomething();
            }
        }

    public:
        ControlBlock* m_ControlBlock = nullptr;
    };

    //Manger类，管理对象集
    class MiniDocument
    {
    public:
        //核心，创建对象，保存对象指针，返回其handle指针供外部使用
        ElmHandle* CreateObject(int id)
        {
            const auto obj = new Object(id);
            auto controlBlock = new ControlBlock();
            obj->m_ControlBlock = controlBlock;
            controlBlock->m_Object = obj;
            controlBlock->m_IsRegister = true;
            const auto handle = new ElmHandle(controlBlock);
            m_Doc.insert(std::pair<int, Object*>(id, obj));
            return handle;
        }

        //移除对象，但并不删除对象，只是外部已经不可调用了
        void Delete(int id)
        {
            if (m_Doc.find(id) != m_Doc.end())
            {
                const auto object = m_Doc[id];
                object->m_ControlBlock->m_IsRegister = false;
                m_Doc.erase(id);
            }
        }

    private:
        std::map<int, Object*> m_Doc;
    };

    class Test
    {
    public:
        Test()
        {
            MiniDocument doc;
            //创建对象，返回其handle指针
            auto h = doc.CreateObject(1);
            //使用handle指针对对象进行操作
            h->DoSomething();
            {
                //移除对象
                doc.Delete(1);
            }
            //通过handle指针来判断对象是否还可用
            if (!h->IsExpired())
            {
                h->DoSomething();
            }
            delete h;
        }
    };

    static Test t;
}
```
这是一个小型的Handle系统。Handle持有controlPtr，并管理其生命周期。通过controlPtr中的m_RefCount来判断对象的引用情况（用以真正的删除对象），通过m_IsRegister来判断对象是否还被Manger持有（用以判断其是否还可调用），将对象的使用和生命周期分开。

Manger类在创建和析构修改controlPtr的状态（m_IsRegister），Handle持有controlPtr。外部对Handle的调用（复制，删除）来调整（m_RefCount）

这个miniHandle使用了裸指针版本，还存在一些不足，但是也有了一个大致的Handle雏形。

## 完整版
下面贴一个完整版的示例代码

```c++
#pragma once

#include "stdafx.h"

BEGIN_GRAPHICS_NAMESPACE

class Element;
class Document;

template<typename _Tp>
struct ElmHandleT;

struct ElmRegisteredHandle;
struct ElmOwnedHandle;

struct __elm_handle_ctrl {
  virtual ~__elm_handle_ctrl() = default;

  __elm_handle_ctrl() noexcept {
    count.all = 0;
  }
  void IncRef() noexcept {
    count.ref++;
  }
  void IncOwn() noexcept {
    IncRef();
    count.own++;
  }
  void IncReg() noexcept {
    IncOwn();
    count.reg++;
  }
  void DecRef() noexcept {
    assert(count.ref > 0);
    count.ref--;

    if (count.ref == 0) {
      __on_ref_to_zero();
    }
  }
  void DecOwn() noexcept {
    assert(count.own > 0);
    count.own--;
    if (count.own == 0) {
      __on_own_to_zero();
    }
    DecRef();
  }

  void DecReg() noexcept {
    assert(count.reg > 0);
    count.reg--;
    if (count.reg == 0) {
      __on_reg_to_zero();
    }

    DecOwn();
  }

  [[nodiscard]] bool IsRegistered() const noexcept {
    return count.reg > 0;
  }

  [[nodiscard]] bool IsOwned() const noexcept {
    return count.own > 0;
  }

  virtual Element* GetElement() = 0;

 protected:
  /// ref 引用计数归零，此时意味着控制块自身要被释放
  virtual void __on_ref_to_zero() noexcept = 0;
  /// own 引用计数归零，此时意味着数据要被释放
  virtual void __on_own_to_zero() noexcept = 0;
  /// reg 引用计数归零
  virtual void __on_reg_to_zero() noexcept = 0;

 protected:
  union {
    uint64_t all;
    struct {
      /// 所有指向对应内存的 handle 都会带来 refCount 的提升，refCount 清零后控制块会被删除
      uint32_t ref;
      /// 内存持有标记，当这个数值清空以后，被指向的内存对象会被删除
      uint16_t own;
      /// 是否注册到 Document 里面，默认情况下，应该最大只有 1。当这个计数器归零时，尽管 own 计数仍然存在，内存内数据保留
      /// ，但是已经无法访问其内容。
      uint16_t reg;
    };

  } count{};
};

template<typename _Tp>
struct __elm_own_handle_ctrl : __elm_handle_ctrl {
  explicit __elm_own_handle_ctrl(_Tp* ptr) noexcept : __ptr_(ptr) {
  }

 protected:
  void __on_ref_to_zero() noexcept override {
    __ptr_ = nullptr;
    delete this;
  }
  void __on_own_to_zero() noexcept override {
    if (__ptr_ != nullptr) {
      // static_assert(sizeof(_Tp) >= 0, "cannot delete an incomplete type");
      // static_assert(!std::is_void<_Tp>::value, "cannot delete an incomplete type");
      delete __ptr_;
      __ptr_ = nullptr;
    }
  }
  void __on_reg_to_zero() noexcept override {
    // do nothing
  }

 public:
  Element* GetElement() override {
    return __ptr_;
  }

 private:
  _Tp* __ptr_;
};

struct __elm_ctrl_impl_own {
  static void inc(__elm_handle_ctrl* ctrl) noexcept {
    if (ctrl != nullptr)
      ctrl->IncOwn();
  }

  static void dec(__elm_handle_ctrl* ctrl) noexcept {
    if (ctrl != nullptr)
      ctrl->DecOwn();
  }
};

/// 最简单的通用的表示 Element 基类的 Handle 类型，规定了接口的类形式（利用子类 Override 可以使用协变类型的特性）
/// ElmHandle 直接使用 ctrl block 里面的基础类型
struct __elm_basic_handle {
  virtual ~__elm_basic_handle() = default;

  explicit __elm_basic_handle(__elm_handle_ctrl* ctrl) noexcept : __ctrl_(ctrl) {
  }

  __elm_basic_handle() noexcept : __elm_basic_handle(nullptr) {
  }

  __elm_basic_handle(__elm_basic_handle&& other) noexcept {
    this->__ctrl_ = other.__ctrl_;
    other.__ctrl_ = nullptr;
  }

  __elm_basic_handle& operator=(__elm_basic_handle&& other) noexcept {
    if (this == &other) {
      return *this;
    }
    releaseControlBlock();
    this->__ctrl_ = other.__ctrl_;
    other.__ctrl_ = nullptr;
    return *this;
  }

  __elm_basic_handle(const __elm_basic_handle& other) noexcept : __elm_basic_handle(other.__ctrl_) {
  }

  __elm_basic_handle& operator=(const __elm_basic_handle& other) noexcept {
    if (this == &other) {
      return *this;
    }
    releaseControlBlock();
    __ctrl_ = other.__ctrl_;
    __ctrl_->IncRef();
    return *this;
  }

  /// 重载 == 运算符（形式1：同类对象之间比较，最常用）
  [[nodiscard]] bool operator==(const __elm_basic_handle& other) const noexcept {
    // 直接判断两个对象的控制块指针是否指向同一个地址（即是否为同一个控制块）
    return this->__ctrl_ == other.__ctrl_;
  }

  /// 重载 != 运算符（与 == 互补，保证操作符完整性）
  [[nodiscard]] bool operator!=(const __elm_basic_handle& other) const noexcept {
    // 复用 == 运算符，避免重复逻辑
    return !(*this == other);
  }

  /// 与 nullptr 比较（增强易用性，符合指针使用习惯）
  [[nodiscard]] bool operator==(std::nullptr_t) const noexcept {
    return Expired();
  }

  [[nodiscard]] bool operator!=(std::nullptr_t) const noexcept {
    return !Expired();
  }

  [[nodiscard]] bool operator!() const noexcept {
    return !Expired();
  };

  virtual Element* operator->() const noexcept {
    if (Expired())
      return nullptr;
    return __ctrl_->GetElement();
  }

  [[nodiscard]] virtual bool Expired() const noexcept = 0;

  virtual void releaseControlBlock() noexcept = 0;

  [[nodiscard]] Element* Get() const {
    if (__ctrl_ == nullptr)
      return nullptr;
    return __ctrl_->GetElement();
  }

  void Reset() {
    releaseControlBlock();
  }

  template<typename _Up>
  [[nodiscard]] bool Is() const noexcept {
    return dynamic_cast<_Up*>(Get()) != nullptr;
  }

  friend struct std::hash<__elm_basic_handle>;
  friend struct std::hash<ElmOwnedHandle>;

  template<typename _Up>
  ElmHandleT<_Up> DynamicCast() const noexcept {
    auto converted = dynamic_cast<_Up*>(Get());
    if (converted == nullptr)
      return {};
    return {converted, __ctrl_};
  }

 protected:
  __elm_handle_ctrl* __ctrl_;
};

struct ElmHandle : __elm_basic_handle {
  explicit ElmHandle(__elm_handle_ctrl* ctrl) : __elm_basic_handle(ctrl) {
    if (__ctrl_ != nullptr)
      __ctrl_->IncRef();
  }

  explicit ElmHandle(const __elm_basic_handle& other) : __elm_basic_handle(other) {
    if (__ctrl_ != nullptr)
      __ctrl_->IncRef();
  }

  ElmHandle() = default;

  [[nodiscard]] bool Expired() const noexcept override {
    return this->__ctrl_ == nullptr || !this->__ctrl_->IsRegistered();
  }
  void releaseControlBlock() noexcept override {
    if (__ctrl_ != nullptr) {
      __ctrl_->DecRef();
      __ctrl_ = nullptr;
    }
  }

  template<typename _Up>
  ElmHandleT<_Up> UnsafeCast() const noexcept {
    return {static_cast<_Up*>(Get()), __ctrl_};
  }
};

template<typename _Tp>
struct ElmHandleT : ElmHandle {
  ElmHandleT(_Tp* ptr, __elm_handle_ctrl* ctrl) : ElmHandle(ctrl), __ptr_(ptr) {
  }

  explicit ElmHandleT(_Tp* ptr, const __elm_basic_handle& other) : ElmHandle(other), __ptr_(ptr) {
  }

  ElmHandleT() noexcept : ElmHandle(nullptr), __ptr_(nullptr) {
  }

  _Tp* operator->() const noexcept override {
    if (Expired())
      return nullptr;
    return __ptr_;
  }

  _Tp* Get() const noexcept {
    return __ptr_;
  }

 private:
  _Tp* __ptr_;
};

struct ElmOwnedHandle : __elm_basic_handle {
  explicit ElmOwnedHandle(__elm_handle_ctrl* ctrl) : __elm_basic_handle(ctrl) {
    if (__ctrl_ != nullptr)
      __ctrl_->IncOwn();
  }

  explicit ElmOwnedHandle(const __elm_basic_handle& other) : __elm_basic_handle(other) {
    if (__ctrl_ != nullptr)
      __ctrl_->IncOwn();
  }

  ElmOwnedHandle() = default;

  [[nodiscard]] bool Expired() const noexcept override {
    return this->__ctrl_ == nullptr || !this->__ctrl_->IsOwned();
  }
  void releaseControlBlock() noexcept override {
    if (__ctrl_ != nullptr) {
      __ctrl_->DecOwn();
      __ctrl_ = nullptr;
    }
  }
};

struct ElmRegisteredHandle : __elm_basic_handle {
 protected:
  explicit ElmRegisteredHandle(__elm_handle_ctrl* ctrl) : __elm_basic_handle(ctrl) {
    if (__ctrl_ != nullptr)
      __ctrl_->IncReg();
  }

 public:
  explicit ElmRegisteredHandle(Element* pElement) noexcept;

  explicit ElmRegisteredHandle(const __elm_basic_handle& other) : __elm_basic_handle(other) {
    if (__ctrl_ != nullptr)
      __ctrl_->IncReg();
  }

  explicit ElmRegisteredHandle() noexcept : __elm_basic_handle(nullptr) {
  }

  void releaseControlBlock() noexcept override {
    if (__ctrl_ != nullptr) {
      __ctrl_->DecReg();
      __ctrl_ = nullptr;
    }
  }

  [[nodiscard]] bool Expired() const noexcept override {
    return __ctrl_ == nullptr || !this->__ctrl_->IsRegistered();
  }
};

END_GRAPHICS_NAMESPACE

template<>
struct std::hash<Pinlan::__elm_basic_handle> {
  size_t operator()(const Pinlan::__elm_basic_handle& _Keyval) const noexcept {
    static std::hash<void*> hasher;
    return hasher(_Keyval.__ctrl_);
  }
};

template<>
struct std::hash<Pinlan::ElmOwnedHandle> {
  size_t operator()(const Pinlan::ElmOwnedHandle& _Keyval) const noexcept {
    static std::hash<void*> hasher;
    return hasher(_Keyval.__ctrl_);
  }
};
```