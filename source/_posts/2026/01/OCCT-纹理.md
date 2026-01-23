---
title: OCCT-纹理
date: 2026-01-13 11:14:56
categories:
    - OCCT
tags:
---

## OCCT 纹理学习

### 创建使用基本纹理

1. 创建一个基础的立方盒模型
```c++
    Handle(AIS_Shape) aBox = new AIS_Shape(BRepPrimAPI_MakeBox(anAxis, 50, 50, 50).Shape());
```
2. 创建一个基本的纹理
```c++
Handle(Graphic3d_Texture2D) texture2d = new Graphic3d_Texture2D(
        R""(C:\Users\ZQD\Desktop\workNote\wallPaper\girl.png)"");
```
图片格式支持常见的图片格式

3. 设置到Aspect管理器，注意，shader的样式管理器默认是不生成的，需要手动创建
```c++
Handle(Prs3d_Drawer) aBoxDrawer = new Prs3d_Drawer();
    aBoxDrawer->SetupOwnShadingAspect();///需要主动创建
    aBox->SetAttributes(aBoxDrawer);
    Handle(Graphic3d_AspectFillArea3d) aspect = aBox->Attributes()->ShadingAspect()->Aspect();
    aspect->SetTextureMap(texture2d);
    aspect->SetTextureMapOn();
    aspect->SetShadingModel(Graphic3d_TOSM_DEFAULT);
    myContext->Display(aBox, AIS_Shaded, 0, false);
```
可以看到效果如图
![](https://gitee.com/nhkao/pic-go/raw/master/20260113135144784.png)


### 对纹理进行调整
```c++
///对uv进行调整
Handle(Graphic3d_TextureParams) params = texture2d->GetParams();
params->SetModulate(false); ///false，直接使用纹理yanse，true：混合纹理和物体原本的颜色
params->SetRotation(45);
params->SetTranslation(Graphic3d_Vec2(0.1, 0.2));
params->SetScale(Graphic3d_Vec2(3.0, 2.0)); ///重复3*2次，主要Repeat开启
params->SetRepeat(true);
params->SetFilter(Graphic3d_TOTF_BILINEAR); ///多级渐远纹理
params->SetAnisoFilter(Graphic3d_LOTA_QUALITY); ///各向异性过滤
```

### 多纹理
OCCT本身似乎只支持一张纹理的快捷使用，如果想使用多张纹理，需要自己编写shader，就如同使用OpenGl一样，下面是一个使用案例：
```c++
//1. 准备两张纹理
Handle(Graphic3d_Texture2D) texColor0 = new Graphic3d_Texture2D(
        R""(C:\Users\ZQD\Desktop\workNote\wallPaper\girl.png)"");

    Handle(Graphic3d_Texture2D) texColor1 = new Graphic3d_Texture2D(
        R""(C:\Users\ZQD\Desktop\workNote\wallPaper\yang.png)"");
///2. 配置纹理参数，如上
Handle(Graphic3d_TextureParams) params0 = texColor0->GetParams();
params0->SetTextureUnit(Graphic3d_TextureUnit_0);
params0->SetModulate(false); ///false，直接使用纹理

Handle(Graphic3d_TextureParams) params1 = texColor1->GetParams();
params1->SetTextureUnit(Graphic3d_TextureUnit_1);
params1->SetModulate(true); ///false，直接使用纹理

///3. 添加到纹理集合
auto textureSet = new Graphic3d_TextureSet(2);
textureSet->SetValue(0, texColor0);
textureSet->SetValue(1, texColor1);

///4. 设置纹理集合
Handle(Prs3d_Drawer) aBoxDrawer = new Prs3d_Drawer();
aBoxDrawer->SetupOwnShadingAspect(); ///需要主动创建
aBox->SetAttributes(aBoxDrawer);
Handle(Graphic3d_AspectFillArea3d) aspect = aBox->Attributes()->ShadingAspect()->Aspect();
aspect->SetTextureSet(textureSet);
aspect->SetTextureMapOn();
aspect->SetShadingModel(Graphic3d_TOSM_DEFAULT);

///5.设置shader
m_Program = new Graphic3d_ShaderProgram();
auto shaderObjectV = Graphic3d_ShaderObject::CreateFromFile(Graphic3d_TOS_VERTEX,
                                                            R""(C:\Tools\OcctImgui\texture.vert)"");
auto shaderObjectF = Graphic3d_ShaderObject::CreateFromFile(Graphic3d_TOS_FRAGMENT,
                                                            R""(C:\Tools\OcctImgui\texture.frag)"");
m_Program->AttachShader(shaderObjectV);
m_Program->AttachShader(shaderObjectF);
m_Program->SetDefaultSampler(false);

///这里我们使用自己的texture
m_Program->PushVariableInt("uTex0", 0);
m_Program->PushVariableInt("uTex1", 1);

if (!m_Program->IsDone())
{
    std::cout << "ShaderProgram NOT done!" << std::endl;
}
aspect->SetShaderProgram(m_Program);
```
与此同时，我们需要自己实现shader
```GLSL
//vert
#ifdef GL_ES
precision highp float;
#endif

// 使用 OCCT 已声明的变量
varying vec4 vWorldPos;
varying vec3 vNormal;
varying vec4 vColor;
varying vec2 vUv;

void main()
{
    // OCCT 已经提供 occVertex / occNormal / occVertColor
    vWorldPos = occModelWorldMatrix * occVertex;
    vNormal = normalize((occModelWorldMatrix * vec4(occNormal, 0.0)).xyz);
    vColor = occVertColor;
    // ✅ OCCT 在 Vertex 阶段提供 occVertColor
    vUv = occTexCoord.xy;
    // 使用 OCCT 的默认矩阵
    gl_Position = occProjectionMatrix * occWorldViewMatrix * vWorldPos;
}
```

```GLSL
//frag
#ifdef GL_ES
precision highp float;
#endif

//uniform sampler2D occSampler0; // 这是OCCT默认定义的
//uniform sampler2D occSampler1; // 这个可能未被定义
uniform sampler2D uTex0; // GL_TEXTURE0，使用自己的texture
uniform sampler2D uTex1; // GL_TEXTURE1
uniform float uTime; // 定义一个时间

varying vec4 vWorldPos; // 世界空间位置
varying vec3 vNormal;
varying vec4 vColor;    // 顶点传递颜色
varying vec2 vUv;   // ✅ 新增

void main()
{
    vec4 col = occColor;///occColor，OCCT前序生成的颜色值
    col = mix(col, mix(texture2D(uTex0, vUv), texture2D(uTex1, vUv), abs(cos(uTime))), 0.5);
    occFragColor = col;

}

```
这样，我们就可以实现多纹理了，效果如下：
![](https://gitee.com/nhkao/pic-go/raw/master/20260116101243171.png)