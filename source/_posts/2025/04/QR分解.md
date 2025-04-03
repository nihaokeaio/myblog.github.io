---
title: QR分解
date: 2025-04-02 16:52:45
categories:
    -算法
	-几何
tags:
    -算法
---

<div align='center' ><font size=6>QR分解</font></div>

## 理论

QR分解的含义
数学定义
对于 $m*n$ 阶矩阵 $A$，如果存在 $m$ 阶可逆矩阵 $Q$ 和 $n$ 阶可逆矩阵 $R$，使得 $A=QR$ 成立，则称其为 $A$ 的 QR 分解。

$Q$是$m*m$的正交矩阵，（即$Q^TQ=I$）

$R$是$m*n$的上三角矩阵。（即$R_{ij}=0,i>j$）

## 计算方法

### 施密特正交化方法
矩阵$A$$的列向量$a_1,a_2,...,a_n$，
则QR分解的施密特正交化方法如下：
1. 令$v_1=a_1$
2. 对于$i=2,3,...,n$，令$v_i=a_i-\sum_{j=1}^{i-1}\frac{a_i^Tv_j}{v_j^Tv_j}v_j$
3. 令$q_i=\frac{v_i}{||v_i||}$
4. 令$R=Q^TA$

## 举例
矩阵 A:
$$
\begin{aligned}
A=\begin{bmatrix}
1 & 2 & 3 \\
4 & 5 & 6 \\
7 & 8 & 9
\end{bmatrix}
\end{aligned}
$$
令 $v_1=a_1$，
$$
\begin{aligned}
v_1=\begin{bmatrix}
1 \\
4 \\
7
\end{bmatrix}
\end{aligned}
$$
对于$i=2$，令$v_2=a_2-\frac{a_2^Tv_1}{v_1^Tv_1}v_1$，
$$
\begin{aligned}
v_2=\begin{bmatrix}
2 \\
5 \\
8
\end{bmatrix}
\end{aligned}
$$

对于$i=3$，令$v_3=a_3-\frac{a_3^Tv_1}{v_1^Tv_1}v_1-\frac{a_3^Tv_2}{v_2^Tv_2}v_2$,
$$
\begin{aligned}
v_3=\begin{bmatrix}
3 \\
6 \\
9
\end{bmatrix}
\end{aligned}
$$
令$q_i=\frac{v_i}{||v_i||}$，
$$
\begin{aligned}
q_1=\begin{bmatrix}
\frac{1}{\sqrt{66}} \\
\frac{2}{\sqrt
{66}} \\
\frac{3}{\sqrt{66}}
\end{bmatrix}
\end{aligned}
$$
$q_2,q_3$同理.
于是，我们可以得到$Q$矩阵：
$$
\begin{aligned}
Q=\
\begin{bmatrix}
\frac{1}{\sqrt{66}} & \frac{4}{\sqrt{66}} & \frac{7}{\sqrt{66}} \\
\frac{2}{\sqrt{66}} & \frac{5}{\sqrt{66}} & \frac{8}{\sqrt{66}} \\
\frac{3}{\sqrt{66}} & \frac{6}{\sqrt{66}} & \frac{9}{\sqrt{66}}
\end{bmatrix}
\end{aligned}
$$

令$R=Q^TA$,于是，我们可以得到$R$矩阵：
$$
\begin{aligned}
R=\begin{bmatrix}
\sqrt{66} & 12 & 18 \\
0 & \sqrt{11} & 22 \\
0 & 0 & \sqrt{6}
\end{bmatrix}
\end{aligned}
$$

## 代码实现
```c++
#include <iostream>
#include <Eigen/Dense>
using namespace std;
int main()
{
    Eigen::MatrixXd A(3, 3);
    A << 1, 2, 3,
    4, 5, 6,
    7, 8, 9;
    
    Eigen::MatrixXd Q(3, 3);
    Eigen::MatrixXd R(3，3);
    Eigen::HouseholderQR<Eigen::MatrixXd> qr(A);
    Q = qr.householderQ();
    R = qr.matrixQR().triangularView<Eigen::Upper>();
    cout << "Q = " << endl << Q << endl;
    cout << "R = " << endl << R << endl;
    return 0;
}
```

## 应用领域
QR分解在许多领域都有广泛的应用，例如线性方程组求解、最小二乘问题、特征值问题等。

### 最小二乘问题

最小二乘问题是指在给定一组数据点 $(x_i, y_i)$ 的情况下，找到一条直线 $y = ax + b$，使得这条直线与数据点的误差平方和最小。

超定方程组的矩阵形式：
$$
\begin{aligned}
Ax=b
\end{aligned}
$$
其中，$A$ 是 $m \times n$ 的矩阵，$x$ 是 $n \times 1$ 的列向量，$b$ 是 $m \times 1$ 的列向量。

将所有数据点代入方程，得到方程组：
$$
\begin{aligned}
\begin{bmatrix}
x_1 & 1 \\
x_2 & 1 \\
\vdots & \vdots \\
x_n & 1
\end{bmatrix}
\begin{bmatrix}
a \\
b
\end{bmatrix}
=
\begin{bmatrix}
y_1 \\
y_2 \\
\vdots \\
y_n
\end{bmatrix}
\end{aligned}
$$

将分解代入最小二乘问题：
$$
\begin{aligned}
\min_{x} ||Ax-b||^2
=
\min_{x} ||QRx-b||^2
=
\min_{x} ||Rx-Q^Tb||^2
\end{aligned}
$$
因为 $Q$ 是正交矩阵，因为正交变换不改变向量的长度，所以 $||Qx|| = ||x||$。



最小二乘问题的解可以通过 QR 分解求解。具体步骤如下：
1. 对矩阵 $A$ 进行 QR 分解，得到 $A = QR$，其中 $Q$ 是 $m \times m$ 的正交矩阵，$R$ 是 $m \times n$ 的上三角矩阵。
2. 将 $b$ 乘以 $Q^T$，得到 $Q^Tb$。
3. 解方程 $Rx = Q^Tb$，得到 $x$。
需要留意的是，这里的$x$其实就是系数$a,b$。

### 代码实现
```c++
#include <iostream>
#include <Eigen/Dense>  // 需要安装Eigen库

int main() {
    // 1. 输入数据点 (x, y)
    Eigen::VectorXd x_data(5);  // x坐标
    Eigen::VectorXd y_data(5);  // y坐标
    x_data << 1, 2, 3, 4, 5;    // 示例数据
    y_data << 1.2, 1.9, 3.1, 4.0, 5.2;

    // 2. 构造矩阵A和向量b (Ax ≈ b)
    int m = x_data.size();
    Eigen::MatrixXd A(m, 2);
    A.col(0) = x_data;          // 第一列: x
    A.col(1) = Eigen::VectorXd::Ones(m); // 第二列: 1 (截距项)

    // 3. 使用QR分解求解
    Eigen::VectorXd solution = A.colPivHouseholderQr().solve(y_data);

    // 4. 输出结果
    double a = solution(0);  // 斜率
    double b = solution(1);  // 截距
    std::cout << "拟合直线方程: y = " << a << "x + " << b << std::endl;

    return 0;
}
```
当然，最小二乘问题可以推广到更高维的情况，例如在三维空间中拟合平面，或者在更高维空间中拟合超平面。
这里给出份代码：
```c++
#include <iostream>
#include <Eigen/Dense>

//任意维度的最小二乘拟合
Eigen::VectorXd polyFit(const Eigen::VectorXd& x, const Eigen::VectorXd& y, int degree) {
    int m = x.size();
    Eigen::MatrixXd A(m, degree + 1);
    //高次项可能会出现数值问题
    for (int i = 0; i <= degree; ++i) {
        A.col(degree - i) = x.array().pow(i); // 从高次到低次排列
    }

    return A.colPivHouseholderQr().solve(y);
}

int main() {
    // 输入数据
    Eigen::VectorXd x_data(5);
    Eigen::VectorXd y_data(5);
    x_data << 1, 2, 3, 4, 5;
    y_data << 1.1, 3.9, 8.9, 16.1, 24.8; // y ≈ x² + noise

    // 构造矩阵A (m×3)
    int m = x_data.size();
    Eigen::MatrixXd A(m, 3);
    A.col(0) = x_data.array().square(); // 第一列: x²
    A.col(1) = x_data;                  // 第二列: x
    A.col(2) = Eigen::VectorXd::Ones(m); // 第三列: 1

    // QR分解求解
    Eigen::VectorXd coeffs = A.colPivHouseholderQr().solve(y_data);

    // 输出结果
    std::cout << "拟合二次曲线: y = " 
              << coeffs[0] << "x² + " 
              << coeffs[1] << "x + " 
              << coeffs[2] << std::endl;

    return 0;
}
```