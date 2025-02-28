---
layout: _page
title: PCA主成分分析
tags algorithm:
---

### 主成分分析（PCA）
这是一种数据降为的方式。具体描述不做过多介绍。这里直接上代码。

```C++
const auto& getMainDir = [&](Vec3Vector holePoints)->Vec3f
				{
					auto srcSize = holePoints.size();
					Eigen::MatrixXd source(srcSize, 3);
					for (int i = 0; i < srcSize; ++i)
					{
						const auto& p = holePoints[i];
						source(i, 0) = p[0];
						source(i, 1) = p[1];
						source(i, 2) = p[2];
					}
					//去中心化
					Eigen::MatrixXd meanVal = source.colwise().mean();
					Eigen::RowVectorXd meanRow = meanVal;
					Eigen::MatrixXd centeredData = source.rowwise() - meanRow;
					//计算协方差
					Eigen::MatrixXd coj;
					coj = centeredData.adjoint() * centeredData;
					coj = coj.array() / (centeredData.rows() - 1);
					//计算特征值与特征向量
					Eigen::MatrixXd vec;
					Eigen::VectorXd val;
					Eigen::SelfAdjointEigenSolver<Eigen::MatrixXd>eig(coj);
					vec = eig.eigenvectors().real();
					val = eig.eigenvalues().real();

					{
						// 创建输出文件流  
						std::ofstream outFile("C:/Users/22676/Desktop/printMesh/Margin/pca_results.txt");
						if (!outFile) {
							std::cerr << "Failed to open output file." << endl;
						}

						// 输出特征值到文件  
						outFile << "Eigenvalues:\n";
						for (int i = 0; i < val.size(); ++i) {
							outFile << val[i] << std::endl;
						}
						outFile << std::endl;

						// 输出特征向量到文件  
						outFile << "Eigenvectors:\n";
						for (int i = 0; i < vec.cols(); ++i) {
							outFile << "Eigenvector " << i + 1 << ":\n";
							for (int j = 0; j < vec.rows(); ++j) {
								outFile << vec(j, i) << " ";
							}
							outFile << std::endl;
							outFile << std::endl; // 在每个特征向量之后添加一个空行以增加可读性  
						}

						// 关闭文件流  
						outFile.close();
					}

					//计算得到最小,最大的特征值
					Eigen::VectorXd maxEigenvector = vec.col(2);
					Eigen::VectorXd minEigenvector = vec.col(0);
					Eigen::VectorXd midEigenvector = vec.col(1);

					Vec3f minVec, maxVec;
					minVec = Vec3f(minEigenvector.x(), minEigenvector.y(), minEigenvector.z()).normalized();
					maxVec = Vec3f(maxEigenvector.x(), maxEigenvector.y(), maxEigenvector.z()).normalized();
					Vec3f midVec = Vec3f(midEigenvector.x(), midEigenvector.y(), midEigenvector.z()).normalized();
					Vec3f temp = (minVec ^ midVec).normalized();
					writeDir(center, temp);

					{
						Eigen::MatrixXd projectedData(srcSize, 2);
						projectedData = centeredData * vec.block<3, 2>(0, 0);
						Vec3Vector temp(srcSize, Vec3f());
						for (int i = 0; i < srcSize; ++i)
						{
							auto& p = temp[i];
							p[0] = projectedData(i, 0);
							p[1] = projectedData(i, 1);
							p[2] = 0;
						}
						writeVector(temp);
					}
					{
						Eigen::MatrixXd projectedData(srcSize, 2);
						projectedData = centeredData * vec.block<3, 2>(1, 0);
						Vec3Vector temp(srcSize, Vec3f());
						for (int i = 0; i < srcSize; ++i)
						{
							auto& p = temp[i];
							p[0] = projectedData(i, 0);
							p[1] = projectedData(i, 1);
							p[2] = 0;
						}
						writeVector(temp);
					}
					
					return maxVec;
				};
```

简要描述：

首先，函数的入参是一个空间三维点集。

转换成Eigen矩阵

去中心化=>移到原点

计算协方差矩阵

计算特征值与特征向量

由于是三维数据，所以会有三个特征值和特征向量。

一般最大的特征值对应的特征向量，表示在该方向上数据的损耗最小，数据保有率最大。