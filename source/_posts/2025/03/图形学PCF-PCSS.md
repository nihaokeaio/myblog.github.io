---
title: 图形学PCF/PCSS
date: 2025-03-01 18:56:45
tags: GAMES202
categories: 
  - 图形学
  - games202
---

# GAMES202 作业一的相关笔记

## 需要注意的是，202相关的内容很多都是和js语言相关。

作业1的主要内容是关于<u>shadow Mapping</u>,重点在于shader的编写部分。因此，对于
整体软件框架不做过多赘述。主要看vs和fs部分。

****************
## 数学基础

1. 根据渲染方程![](https://gitee.com/nhkao/pic-go/raw/master/20250301192606113.png)
2. 根据微积分中的很多不等式![柯西-施瓦兹(Cauchy-Schwarz)不等式](https://gitee.com/nhkao/pic-go/raw/master/20250301194952281.png)
3. 通过一定的变换，我们可以得到
    ![](https://gitee.com/nhkao/pic-go/raw/master/20250301195129872.png)   
    这里多了一个分母的原因是，我们需要对其做归一化！
    约等式成立的前提条件是：
    a. g(x)积分的support较小。这里的support我们可以暂时理解为积分域。
    b. g(x)在积分域上足够光滑（g(x)变化不大=>smooth）。     
4. 于是我们可以将渲染方程拆解出来。![](https://gitee.com/nhkao/pic-go/raw/master/20250301192145299.png)
5. 对于渲染方程，
    a. 当我们是一个点光源或者一个方向光源时，它的积分域为delta
    b. 对于积分域内的函数g(x),首先Li是光源，我们认为其在入射的立体角内是smooth的，我们的brdf的如果是diffuse的，那么我们可以认为等式是比较准确的。（brdf若是glossy，可能就不那么准了，当然也可以强行用=>Ambition occlusion(环境光遮蔽)）
6. 因为积分域足够小，因此，我们可以直接使用点乘来代表阴影遮蔽情况
    ```glsl
    vec3 phongColor = blinnPhong();
    gl_FragColor = vec4(phongColor * visibility, 1.0);
    ```

*******************
## 作业分析

### 传递正确的mvp矩阵，确保模型可以正常的显示
   ```js
   CalcLightMVP(translate, scale) {
        let lightMVP = mat4.create();
        let modelMatrix = mat4.create();
        let viewMatrix = mat4.create();
        let projectionMatrix = mat4.create();

        // Model transform
        mat4.translate(modelMatrix, modelMatrix, translate);
        mat4.scale(modelMatrix, modelMatrix, scale);

        // View transform
        mat4.lookAt(viewMatrix, this.lightPos, this.focalPoint, this.lightUp);

        // Projection transform
        var r = 100;
        var l = -r;

        var t = 100;
        var b = -t;

        var n = 0.01;
        var f = 200;

        mat4.ortho(projectionMatrix, l, r, b, t, n, f);

        mat4.multiply(lightMVP, projectionMatrix, viewMatrix);
        mat4.multiply(lightMVP, lightMVP, modelMatrix);

        return lightMVP;
    }
   ```
    我对js语言不太了解，但是大概可以看出，首先我们创建几个单位矩阵，函数的入参主要是包含一个移动向量和一个缩放向量。我们使用相关的函数把向量转移到矩阵上去。通过现有的函数得到视图矩阵。然后手动设置一个范围，得到一个正交矩阵。最后，我们把矩阵依次相乘，就可以得到MVP矩阵。实现了模型从物理空间到世界空间的变换。

### 在shader中实现阴影  
   
首先我们可以得到没有阴影的blinnPhong模型(visible=1.0)![blinnPhong视图](https://gitee.com/nhkao/pic-go/raw/master/20250301191917128.png)
   
可以看到使用代码如下：
```glsl
void main(void) {

  float visibility;

  vec3 shadowCoord= vPositionFromLight.xyz/vPositionFromLight.w;
  shadowCoord=shadowCoord*0.5+0.5;

  //visibility = useShadowMap(uShadowMap, vec4(shadowCoord, 1.0));
  //visibility = PCF(uShadowMap, vec4(shadowCoord, 1.0));
  visibility = PCSS(uShadowMap, vec4(shadowCoord, 1.0));

  vec3 phongColor = blinnPhong();

  gl_FragColor = vec4(phongColor * visibility, 1.0);
}
``` 
其中，这行代码的作业是将投影后的光空间下的顶点归一化。对于正交矩阵，其实可以不用，因为其```vPositionFromLight.w```的值始终为1.0。但投影矩阵是需要归一化的！
```C
vec3 shadowCoord= vPositionFromLight.xyz/vPositionFromLight.w;
```
在光空间进行mvp矩阵变换后，模型的点集会被压缩到$[-1,1]^{3}$的包围盒内，因此，我们需要做一定的变换将其转换为$[0,1]^{3}$内。

#### 实现shadow mapping
首先看useShadowMap的代码以及效果图：
```glsl
float useShadowMap(sampler2D shadowMap, vec4 shadowCoord){

  float currentDepth=shadowCoord.z;
  float closeDepth=vec3(texture2D(shadowMap,shadowCoord.xy)).r;
  vec3 lightDir=normalize(uLightPos-vFragPos);
  //float bias=0.005;
  float bias = max(0.05 * (1.0 - dot(vNormal, lightDir)), 0.01);
  float visibility=currentDepth > closeDepth + bias? 0.0 : 1.0;
  return visibility; 
}
```
![shader Mapping效果图](https://gitee.com/nhkao/pic-go/raw/master/20250301203303819.png)

在useShadowMap中，我们首先得到当前shaderPoint的z值。然后通过纹理采样的方式(在光空间下，我们已经将z值存储到了一张纹理中)。这边重点需要注意的是：**为什么采用用的是shadowCoord.xy？**
**注意，这里的shadowCoord其实来自于vPositionFromLight，也就是说，我们已经计算得到了模型在光空间下的xyz值。而这张纹理也是在光空间下取得的深度图纹理。因此这样采样才是正确的！**
通过采样，我们得到了光空间下的z值。因此，对于当前的shaderPoint，我们将其与光源连接并计算得到到光源的距离。然后与前面采用得到的深度值进行比较，就可以判断出当前这个shaderPoint是否有被遮挡了。(当光空间下的深度值较小时，说明有物体挡住了)
这里会有几个问题
1. 当光空间下记录的纹理分辨率较小时，使用这种方式得到的阴影效果在边界处就会很明显的方块感。
   **解决办法**是增大分辨率，但可能会出现存储问题。
2. 出现自遮挡情况。原因就是在光空间如果光线有一定的倾斜角照射物体。那么这时一个像素代表的深度值跨度就会很大。而执行shadows mapping时，可能空间中的一个点在这个跨度内，那么他到光源的距离就会大于前面记录的深度值。然后被错误的判定为是在阴影中！![](https://gitee.com/nhkao/pic-go/raw/master/20250301202814987.png)
   **解决办法**是我们将采样得到的深度值跟随角度增大一点，可以一定程度上减少这种自遮挡情况
3. 边界处为硬阴影，不够柔和，于是，引入了PCF。


#### 实现PCF
首先看PCF的代码以及效果图：
```GLSL
float PCF(sampler2D shadowMap, vec4 coords) 
{
  float currentDepth=coords.z;
  float visibility=0.0;
  float bias = Bais();

  vec2 textlSize = vec2(1.0/float(TEXTURESIZE));
  if(false)
  {
    for (int x = -2; x <= 2; ++x)
      {
        for (int y = -2; y <= 2; ++y)
        {
            float closeDepth = unpack(texture2D(shadowMap, vec2(x, y) * textlSize + coords.xy));
            visibility += currentDepth > closeDepth + bias ? 0.0 : 1.0;
        }
      }
    visibility /= 25.0;
  }
 
  if(true)
  {
    poissonDiskSamples(coords.xy);
    for(int i = 0; i < NUM_SAMPLES; i++ )
    {
      vec4 closeDepthVec = texture2D(shadowMap, poissonDisk[i]* textlSize *5.0 + coords.xy);
      float closeDepth=unpack(closeDepthVec);
      visibility += currentDepth < closeDepth + bias ? 1.0 : 0.0;
    }
    visibility /= float(NUM_SAMPLES);
  }
   
  return visibility;
}
```
![PCF效果图](https://gitee.com/nhkao/pic-go/raw/master/20250301203540630.png)

可以看到，他和shader Mapping其实没什么差别，其中[poissonDiskSamples](https://codepen.io/arkhamwjz/pen/MWbqJNG?editors=1010)是一种比较好的采样方式，当然也可以使用均匀采样。它的主要特点就是采样纹理周围一定的区域，得到一个平均深度值。这样可以让边界处得到较好的过滤！
到这里其实效果还可以，但是看着还是有点假~，其实在生活中，我们会发现，阴影在靠近遮挡物时，比较硬，远离遮挡物时，比较软。也就是说，我们需要动态的调整这个采样的范围，这样，就可以实现不同阴影软硬程度。于是就引出了PCSS

#### PCSS
直接看效果图和代码：
![PCSS效果图](https://gitee.com/nhkao/pic-go/raw/master/20250301204819899.png)
```GLSL
float PCSS(sampler2D shadowMap, vec4 coords){

  float currentDepth=coords.z;
  float visibility=0.0;
  vec3 lightDir = normalize(uLightPos - vFragPos);
  float bias = max(BIAS * (1.0 - dot(vNormal, lightDir)), BIAS*0.1);

  poissonDiskSamples(coords.xy);
  // STEP 1: avgblocker depth
  float averageBlockerDepth=findBlocker(shadowMap,coords.xy,coords.z);

  // STEP 2: penumbra size
  float sampleRange = float(PCF_NUM_SAMPLES) * (coords.z - averageBlockerDepth) /averageBlockerDepth;

  // STEP 3: filtering
  vec2 textlSize = vec2(1.0/float(TEXTURESIZE));
  for(int i = 0; i < NUM_SAMPLES; i++ )
    {
      float closeDepth = unpack(texture2D(shadowMap, poissonDisk[i]* textlSize * sampleRange + coords.xy));
      visibility += currentDepth > closeDepth + bias ? 0.0 : 1.0;
    }
  visibility /= float(NUM_SAMPLES);
  
  return visibility;

}
```
在看这里的关键函数findBlocker：
```GLSL
float findBlocker( sampler2D shadowMap,  vec2 uv, float zReceiver ) {
  float bias =Bais();
  float blockerDepth=0.0;
  float count=0.0;
  float closeDepth = unpack(texture2D(shadowMap,uv));
  float blockSearchNum = closeDepth/zReceiver * float(BLOCKER_SEARCH_NUM_SAMPLES);
  vec2 textlSize = vec2(1.0/float(TEXTURESIZE));
  for(int i=0;i< NUM_SAMPLES;++i)
  {
    float shadowMapDepth =unpack(texture2D(shadowMap,uv+poissonDisk[i]* textlSize * blockSearchNum ));
    bool isV = zReceiver >shadowMapDepth + bias  ? false : true;
    if(!isV)
    {
      blockerDepth+=shadowMapDepth;
      count++;
    }
  }
  if(count==0.0)
  {
    return 1.0;
  }
  if(count==float(BLOCKER_SEARCH_NUM_SAMPLES ))
  {
    return 0.0;
  }
  return blockerDepth/count;
  //return 1.0;
}
```
这个函数的左右是也是寻找平均深度值，但是只考虑被遮挡处的深度值权重。此外，若完全没遮挡和全部被遮挡的情况也需要考虑。这部其实和PCF类似。


再看这块函数
```GLSL
float sampleRange = float(PCF_NUM_SAMPLES) * (coords.z - averageBlockerDepth) /averageBlockerDepth;
```
在前面得到平均深度值后，我们计算他到被遮挡处的距离以及到遮挡处距离的比重，来动态调整采样区的大小。由此，就可以实现在靠近遮挡物时``coords.z - averageBlockerDepth``值较小，所得到的采样区也会比较小，那么阴影就会相对比较硬。反之亦成立！