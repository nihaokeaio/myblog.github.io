---
layout: _page
title: OpenGl_Chapter_1
date: 2024-08-16 16:28:55
tags OpenGl:
---

## <center>OpenGl

参考教程： [learnOpenGlCn](https://learnopengl-cn.github.io/)

## GLFW
GLFW是一个专门针对OpenGL的C语言库，它提供了一些渲染物体所需的最低限度的接口。因此，底层使用glfw构建。

## GLAD
GLAD是一个开源的库，用于解决OpenGl对于不同的显卡厂商，相同函数的函数地址在编译时不确定的问题。

## 窗口

```C++
int main()
{
    glfwInit();
    glfwWindowHint(GLFW_CONTEXT_VERSION_MAJOR, 3);
    glfwWindowHint(GLFW_CONTEXT_VERSION_MINOR, 3);
    glfwWindowHint(GLFW_OPENGL_PROFILE, GLFW_OPENGL_CORE_PROFILE);
    //glfwWindowHint(GLFW_OPENGL_FORWARD_COMPAT, GL_TRUE);

    return 0;
}
```
glfwInit(); 用于初始化glfw，glfwWindowHint，设置glfw大小版本号，并使用core模式。

创建窗口
```C++
GLFWwindow* window = glfwCreateWindow(800, 600, "LearnOpenGL", NULL, NULL);
if (window == NULL)
{
    std::cout << "Failed to create GLFW window" << std::endl;
    glfwTerminate();
    return -1;
}
glfwMakeContextCurrent(window);
```

初始化GLAD,管理指针地址
```C++
if (!gladLoadGLLoader((GLADloadproc)glfwGetProcAddress))
{
    std::cout << "Failed to initialize GLAD" << std::endl;
    return -1;
}
```
设置渲染窗口（可以小于主窗口）
```C++
glViewport(0, 0, 800, 600);
```

注册回调函数，告诉GLFW窗口改变时，跟随渲染
```C++
glfwSetFramebufferSizeCallback(window, framebuffer_size_callback);
```
为了保证窗口常显示，我们使用循环，渲染

```C++
while(!glfwWindowShouldClose(window))
{
    glfwSwapBuffers(window);
    glfwPollEvents();    
}
```
最后，程序结束，释放资源文件
```C++
glfwTerminate();
return 0;
```

此外，我们添加一些按键输入作为回调函数
```C++
void processInput(GLFWwindow *window)
{
    if(glfwGetKey(window, GLFW_KEY_ESCAPE) == GLFW_PRESS)
        glfwSetWindowShouldClose(window, true);
}
```

总体的渲染还击大致为:
```C++
// 渲染循环
while(!glfwWindowShouldClose(window))
{
    // 输入
    processInput(window);
    
    glClearColor(0.2f, 0.3f, 0.3f, 1.0f);
    //情况屏幕缓冲颜色，并以glClearColor中的颜色填充
    glClear(GL_COLOR_BUFFER_BIT);
    // 渲染指令
    ...

    // 检查并调用事件，交换缓冲
    glfwPollEvents();
    glfwSwapBuffers(window);
}
```