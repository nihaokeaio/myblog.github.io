---
title: SignalSlot
date: 2026-06-30 11:42:09
categories:
    - Cpp
tags:
    - Cpp
---

## QT@SignalSlot仿写

### 背景

在C++的代码中，不管是处于编译的需要，还是模块的设计，我们往往需要设计很多事件回调的机制以及消息收发机制。比如常见的MVC结构中，传统的消息链路或者说调用一直一般都是Control->View->Model层，但是model层的数据更新往往需要通知View层进行渲染更新，而这我们常常采用回调机制来实现。

传统的回调创建方式各异，而且往往需要持有一个函数指针对象，没有断开连接，已经生命周期管理的问题，QT的信号槽机制异常强大，但要使用其功能往往需要安装QT库，如果只是为了使用信号槽机制而不是UI组件就引入QT，虽然可行但是库体积会急剧增大，因此，我尝试模仿QT,自己编写一个简易的信号槽机制模块，短小精悍，使用原生C++内容，作为小型库集成也更加方便。

### 学习历程

我将以自己学习的历程展示信号槽的搭建过程。盘点设计思路以及可能会因为什么问题导致我们需要进一步优化该版本。

#### 第一版

```c++
namespace Version1
{
    template <typename... Args>
    class Signal
    {
        using Slot = std::function<void(Args...)>;

    public:
        void connect(Slot slot)
        {
            slots.push_back(slot);
        }

        void emit(Args... args)
        {
            for (auto& s : slots)
            {
                s(args...);
            }
        }

    private:
        std::vector<Slot> slots;
    };

    ///问题：当s指向的对象被析构时，s(args...)会崩溃，考虑使用weak_ptr
}
```
第一版非常朴素，我设计了一个connect以及emit接口，用来连接以及触发消息。Signal对象持有一个函数指针的容器。需要注意的是，emit在发生消息时，所有的槽函数都会被执行，这本身就已经是对传统回调单对单的一种升级

但这里显然有不少问题:
- 当s指向的对象被析构时，s(args...)会崩溃

#### 第二版
```C++
namespace Version2
{
    template <typename... Args>
    class Signal
    {
        struct Slot
        {
            std::function<void(Args...)> fun;
            std::weak_ptr<void> object;
        };

    public:
        template <class T>
        void connect(const std::shared_ptr<T>& object, void (T::*method)(Args... args))
        {
            Slot s;
            std::weak_ptr<T> weakObject = object;
            s.object = object;
            s.fun = [weakObject,method](Args... args)
            {
                if (auto obj = weakObject.lock())
                {
                    (obj.get()->*method)(args...);
                }
            };
            slots.push_back(s);
        }

        void emit(Args... args)
        {
            for (auto it = slots.begin(); it != slots.end();)
            {
                if (it->object.expired())
                {
                    it = slots.erase(it);
                }
                else
                {
                    it->fun(args...);
                    ++it;
                }
            }
        }

    private:
        std::vector<Slot> slots;
    };

    ///问题：如何断开连接呢
}
```
第二版的代码就稍长一些了。这里的相比第一版，核心是为了解决对象析构后，调用槽函数会崩溃的问题。

这里connect函数的入参改成了对象以及其类成员函数，Slot结构体中使用weak_ptr指针探测对象生命周期，并使用了懒移除的方式（用到时删除无效槽对象）。

需要注意的是，Lambda表达式捕获列表需要捕获weak_ptr对象而不是原始的shared_ptr对象，否则就会延长外部对象生命周期导致其``if (it->object.expired())``无法被有效判断为空。
但这版显然还存在一个大问题:

- 如何断开连接
- 匿名函数，普通函数该怎么connect

#### 第三版

```c++
namespace Version3
{
    template <typename... Args>
    struct SlotBase
    {
        virtual ~SlotBase() = default;
        virtual bool isAlive() =0;

    public:
        std::function<void(Args...)> fun;
        std::weak_ptr<void> object;
    };

    template <typename... Args>
    struct MemberSlot : SlotBase<Args...>
    {
        bool isAlive() override
        {
            return !object.expired();
        }
    };

    template <typename... Args>
    struct LambdaSlot : SlotBase<Args...>
    {
        bool isAlive() override
        {
            return true;
        }
    };


    class Connection
    {
    public:
        explicit Connection(const std::function<void()>& f): disConnectFun(f)
        {
        }

        void disConnect() const
        {
            if (disConnectFun)
            {
                disConnectFun();
            }
        }

    private:
        std::function<void()> disConnectFun;
    };


    template <typename... Args>
    class Signal
    {
    public:
        ///类成员函数
        template <class T>
        Connection connect(const std::shared_ptr<T>& object, void (T::*method)(Args... args))
        {
            auto s = std::make_shared<MemberSlot<Args...>>();
            std::weak_ptr<T> weakObject = object;
            s->object = object;
            s->fun = [weakObject,method](Args... args)
            {
                if (auto obj = weakObject.lock())
                {
                    (obj.get()->*method)(args...);
                }
            };
            slots.push_back(s);
            return Connection([this,s]()
            {
                slots.erase(std::remove(slots.begin(), slots.end(), s), slots.end());
            });
        }

        ///匿名函数
        Connection connect(const std::function<void(Args... args)>& f)
        {
            auto s = std::make_shared<LambdaSlot<Args...>>();
            s->fun = f;
            slots.push_back(s);
            return Connection([this,s]()
            {
                slots.erase(std::remove(slots.begin(), slots.end(), s), slots.end());
            });
        }

        void emit(Args... args)
        {
            for (auto it = slots.begin(); it != slots.end();)
            {
                if (!(*it)->isAlive())
                {
                    it = slots.erase(it);
                }
                else
                {
                    (*it)->fun(args...);
                    ++it;
                }
            }
        }

    private:
        std::vector<std::shared_ptr<SlotBase<Args...>>> slots{};
    };
}
```

这一版直接将匿名函数和类成员函数拆成了两个版本，并分别重写了IsAlive的问题，这样可以做到emit时判断存活逻辑的统一。

这一版还返回了Connection对象，并为其默认添加了断开连接的匿名函数，这样，外部调用者可以主动断开连接。

这版还存在的问题:

- 存在因此的风险，比如signal对象如果先于Connection对象析构，那么后者调用disConnect会UB
- 还没有真正做到像QT那样connect(a,&A::signal,b,&B::Slot)那样的形式，现在用起来还并不优化

#### 第四版
```c++
namespace Version4
{
    ///使用Version3版本的Version3::Signal
    Version::Signal;
    ///类型提取器
    template <typename T>
    struct FunctionTraits;

    ///普通函数
    template <typename R, typename... Args>
    struct FunctionTraits<R(*)(Args...)>
    {
        using ReturnType = R;
        using ArgsTuple = std::tuple<Args...>;
    };

    ///类成员函数
    template <typename C, typename R, typename... Args>
    struct FunctionTraits<R(C::*)(Args...)>
    {
        using ClassType = C;
        using ReturnType = R;
        using ArgsTuple = std::tuple<Args...>;
    };

    ///类成员变量
    template <typename C, typename T>
    struct FunctionTraits<T C::*>
    {
        using MemberType = T;
    };

    ///类成员函数const
    template <typename C, typename R, typename... Args>
    struct FunctionTraits<R(C::*)(Args...) const>
    {
        using ClassType = C;
        using ReturnType = R;
        using ArgsTuple = std::tuple<Args...>;
    };

    template <typename Sender, typename SignalType, typename Receiver, typename SlotType>
    Connection connect(Sender* sender, SignalType signal, Receiver* receiver, SlotType slot)
    {
        //1. 提取类型
        using SignalTraits = FunctionTraits<SignalType>;
        using SlotTraits = FunctionTraits<SlotType>;

        using SignalClass = typename SignalTraits::MemberType;
        using SignalArgs = typename SignalClass::ArgsTuple;
        using ReceiverArgs = typename SlotTraits::ArgsTuple;

        ///类型检查器
        //TypeDumper<typename SlotTraits::ArgsTuple> dump1;

        //2. 编译检查
        static_assert(std::is_same_v<SignalArgs, ReceiverArgs>, "Signal and Slot arguments must match!");

        // 3. 真正连接（调用你已有的 Signal::connect）
        return (sender->*signal).connect([receiver,slot](auto&&... args)
        {
            (receiver->*slot)(std::forward<decltype(args)>(args)...);
        });
    }
}
```

这个版本相较于前一个版本，核心是增加了一个connect函数，并在其内部萃取类型，判断信号与槽的参数类型。类似于一个语法糖的接口，但还是有一个比较严重的问题：

- Connection以及receiver的生命周期并没有解决。

#### 第五版
```c++
namespace Version5
{
    class Connection
    {
    public:
        explicit Connection(const std::function<void()>& f): disConnectFun(f)
        {
        }

        void disConnect() const
        {
            if (disConnectFun)
            {
                disConnectFun();
            }
        }

    private:
        std::function<void()> disConnectFun;
    };

    class Trackable
    {
    public:
        ~Trackable()
        {
            // 析构时自动断开所有连接
            for (auto& conn : connections)
            {
                if (conn) conn->disConnect();
            }
        }

        void addConnection(const std::shared_ptr<Connection>& conn)
        {
            connections.push_back(conn);
        }

    private:
        std::vector<std::shared_ptr<Connection>> connections;
    };


    template <typename... Args>
    class Signal
    {
    public:
        struct Slot
        {
            std::function<void(Args...)> fun;
            Connection* connection;
        };

        using Signature = void(Args...);
        using ArgsTuple = std::tuple<Args...>;
        ///类成员函数版本并不会被调用
       
        ///匿名函数
        std::shared_ptr<Connection> connect(const std::function<void(Args... args)>& f)
        {
            auto s = std::make_shared<Slot>();
            s->fun = f;
            slots.push_back(s);
            return std::make_shared<Connection>([this,s]()
            {
                slots.erase(std::remove(slots.begin(), slots.end(), s), slots.end());
            });
        }

        void emit(Args... args)
        {
            for (auto s : slots)
            {
                s->fun(args...);
            }
        }

    private:
        std::vector<std::shared_ptr<Slot>> slots{};
    };

    ///类型提取器
    template <typename T>
    struct FunctionTraits;

    

    template <typename Sender, typename SignalType, typename Receiver, typename SlotType>
    std::shared_ptr<Connection> connect(Sender* sender, SignalType signal, Receiver* receiver, SlotType slot)
    {
        //类型检查
        static_assert(std::is_base_of_v<Trackable, Receiver>, "Receiver must be derived from Trackable");
        // 连接
        auto conn = (sender->*signal).connect([receiver,slot](auto&&... args)
        {
            (receiver->*slot)(std::forward<decltype(args)>(args)...);
        });
        static_cast<Trackable*>(receiver)->addConnection(conn);
        return conn;
    }
    ///A并不一定需要继承Trackable
    class A : public Trackable
    {
    public:
        Signal<int> sig;
    };

    class B : public Trackable
    {
    public:
        void onSig(int x)
        {
            std::cout << "B::onSig " << x << "\n";
        }
    };
}
```

第五版的核心，是把Connection的生命周期交予对象本身来管理。Trackable类持有连接，而我们的对象继承Trackable，当我们自己的对象析构时，自动释放连接。这样，我们把槽函数生命的有效性从emit函数中移除了，也就是说，我们不在主动判定对象是否还活着，而是对象析构时自动断开连接。

``static_cast<Trackable*>(receiver)->addConnection(conn);``在构建完连接对象后，将连接对象Connection放入对象基类Trackable中。

但是这版还是有一个核心问题没有解决:

- Connection构造时，捕获了Signal指针，但其生命周期可能先于Connection析构，导致receiver析构调用时再次引用Signal指针，导致UB问题。

#### 第六版

```c++
namespace Version6
{
    using Connection = Version5::Connection;
    using Trackable = Version5::Trackable;

    template <typename... Args>
    class Signal
    {
    public:
        Signal(): m_State(std::make_shared<State>())
        {
        }

        struct Slot
        {
            std::function<void(Args...)> fun;
        };

        struct State
        {
            std::vector<std::shared_ptr<Slot>> slots{};
        };

        using Signature = void(Args...);
        using ArgsTuple = std::tuple<Args...>;

        ///匿名函数
        std::shared_ptr<Connection> connect(const std::function<void(Args... args)>& f)
        {
            auto s = std::make_shared<Slot>();
            s->fun = f;
            m_State->slots.push_back(s);
            std::weak_ptr<State> weakState = m_State;
            auto conn = std::make_shared<Connection>([weakState,s]()
            {
                if (auto state = weakState.lock())
                {
                    state->slots.erase(std::remove(state->slots.begin(), state->slots.end(), s), state->slots.end());
                }
            });
            return conn;
        }

        void emit(Args... args)
        {
            for (const auto& s : m_State->slots)
            {
                s->fun(args...);
            }
        }

    private:
        std::shared_ptr<State> m_State;
    };

}
```

第六版的核心是为了解决signal对象提前析构可能导致的UB问题，这里我用了一个State包裹了Slots容器，然后将其weak_ptr传入Connection的DisConnected函数，这样，在Connection执行断开时，通过State的weak_Ptr探针来确定signal的存活性，这样就优雅解决了signal对象提前析构可能导致的UB问题！

到第六版为止，这里已经解决了sender对象以及receiver对象分别提前死亡，可能导致的连接问题。已经可以作为一个基础的版本应用于绝大部分场景了。


#### 第七版
```c++
class ConnectionScope
    {
    public:
        explicit ConnectionScope(const std::shared_ptr<Connection>& connection): m_Connection(connection)
        {
        }

        ~ConnectionScope()
        {
            if (m_Connection)
            {
                m_Connection->disConnect();
            }
        }

    private:
        std::shared_ptr<Connection> m_Connection;
    };

    ///其他实现

    template <typename Sender, typename SignalType, typename Receiver, typename SlotType>
    std::shared_ptr<ConnectionScope> connectScope(Sender* sender, SignalType signal, Receiver* receiver, SlotType slot)
    {
        return std::make_shared<ConnectionScope>(connect(sender, signal, receiver, slot));
    }
```
第七版的核心，是用一个Scope包裹connect，然后在其析构函数断开连接，这是一种作用域型的信号槽连接方式，防止用户忘记断开。


#### 第八版

```c++
template <typename Callable, typename Object, typename Tuple>
struct IsInvocableWithTuple;

template <typename Callable, typename Object, typename... Args>
struct IsInvocableWithTuple<Callable, Object, std::tuple<Args...>>
{
    static constexpr bool value = std::is_invocable_v<Callable, Object, Args...>;
};

template <typename Sender, typename SignalType, typename Receiver, typename SlotType>
std::enable_if_t<IsInvocableWithTuple<SlotType, Receiver*, typename FunctionTraits<
                                            SignalType>::MemberType::ArgsTuple>::value, std::shared_ptr<Connection>>
connect(Sender* sender, SignalType signal, Receiver* receiver, SlotType slot)
{
    //具体的连接逻辑
}

///ConnectionScope实现
template <typename Callable, typename Object, typename... Args>
concept Invocable = IsInvocableWithTuple<Callable, Object, Args...>::value;

template <typename Sender, typename SignalType, typename Receiver, typename SlotType>
    requires Invocable<SlotType, Receiver*, typename FunctionTraits<SignalType>::MemberType::ArgsTuple>
std::shared_ptr<ConnectionScope> connectScope(Sender* sender, SignalType signal, Receiver* receiver, SlotType slot)
{
    return std::make_shared<ConnectionScope>(connect(sender, signal, receiver, slot));
}

```

这一版，主要做了一个模板偏特化的实现机制，这里练习了传统的``std::is_invocable_v``以及C++20的``concept``，用来实现对可调用机制的模板偏特化。之前的版本，信号参数与槽函数参数必须完全匹配，并做了静态检查，当前版本修改为若可调用，则生成一份偏特化的函数实现，这样就是实现了形如``double->int``这样传参的版本。


#### 第九版

```C++
template <typename... Args>
class Signal
{
public:
    Signal(): m_State(std::make_shared<State>())
    {
    }

    struct Slot
    {
        std::function<void(Args...)> fun;
        bool connected = true;
    };

    struct State
    {
        std::vector<std::shared_ptr<Slot>> slots{};
    };

    using Signature = void(Args...);
    using ArgsTuple = std::tuple<Args...>;

    ///匿名函数
    std::shared_ptr<Connection> connect(const std::function<void(Args... args)>& f)
    {
        auto s = std::make_shared<Slot>();
        s->fun = f;
        m_State->slots.push_back(s);
        std::weak_ptr<State> weakState = m_State;
        auto conn = std::make_shared<Connection>([weakState,s]()
        {
            if (auto state = weakState.lock())
            {
                //state->slots.erase(std::remove(state->slots.begin(), state->slots.end(), s), state->slots.end());
                s->connected = false;
            }
        });
        return conn;
    }

    void emit(Args... args)
    {
        auto slots = m_State->slots;
        for (const auto& s : slots)
        {
            ///保护m_State->slots以防止其在 s->fun(args...)中被修改
            if (s->connected)
                s->fun(args...);
        }
        cleanUp();
    }

private:
    void cleanUp()
    {
        std::erase_if(m_State->slots, [](const std::shared_ptr<Slot>& slot)
        {
            return !slot->connected;
        });
    }

private:
    std::shared_ptr<State> m_State;
};

///槽函数版本的模板偏特化
template <typename Callable, typename Tuple>
struct IsInvocableWithTupleLambda;

template <typename Callable, typename... Args>
struct IsInvocableWithTupleLambda<Callable, std::tuple<Args...>>
{
    static constexpr bool value = std::is_invocable_v<Callable, Args...>;
};

template <typename Callable, typename... Args>
concept InvocableLambda = IsInvocableWithTupleLambda<Callable, Args...>::value;

/// 槽函数版本
template <typename Sender, typename SignalType, typename SlotType>
    requires InvocableLambda<SlotType, typename FunctionTraits<SignalType>::MemberType::ArgsTuple>
std::shared_ptr<ConnectionScope> connectScope(Sender* sender, SignalType signal, SlotType slot)
{
    return std::make_shared<ConnectionScope>(connect(sender, signal, slot));
}

template <typename Sender, typename SignalType, typename SlotType>
std::enable_if_t<IsInvocableWithTupleLambda<SlotType, typename FunctionTraits<
                                                SignalType>::MemberType::ArgsTuple>::value, std::shared_ptr<
                        Connection>>
connect(Sender* sender, SignalType signal, SlotType slot)
{
    auto conn = (sender->*signal).connect([slot]<typename... T0>(T0&&... args)
    {
        std::invoke(slot, std::forward<T0>(args)...);
    });
    return conn;
}
```

第九版的核心，是解决槽函数调用时，发生断开连接的情况，从而发生修改``m_State->slots``容器的行为，这会导致的迭代器失效，造成UB行为。第九版改为了先复制一份slots的快照，在断开时只做标识，最后在emit之后统一删除无效槽的逻辑，保证了槽函数调用时断开其他连接的安全性。


#### MiniSignal最终版

最终版对于第九版做了一些细节上的优化，这里就不再贴统一代码了，可以详见项目链接
[QT信号量仿写](https://github.com/nihaokeaio/CppPlayGround/tree/SignalSlotFeat)

主要优化了一下内容：
- ConnectionScope 不可拷贝，只允许移动
- connectScope() 返回值对象
- Trackable 不可拷贝
- lambda 捕获使用 move


### 总结
这是一次关于QT信号槽的简单模仿，虽然只是实现了单线程的版本，但相比于传统的函数回调机制，已经有了极大的改进！
这次仿写主要实现了一下功能：
- Connection实现手动断开
- ScopeConnection 作用域断开
- Trackable receiver 析构自动断开
- Signal 内部 State 防止 sender 先析构时的异常行为
- emit 快照 + [bool]connected 标记，防止遍历期间修改容器造成异常行为
- 成员函数槽和 lambda类型槽函数
- std::invoke / invocable 编译检查
