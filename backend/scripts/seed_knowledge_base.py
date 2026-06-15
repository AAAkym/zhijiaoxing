import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.user import db, User
from src.models.course import Course
from src.models.knowledge_base import CourseSyllabus, CourseChapter, KnowledgePoint, TeachingCase, CourseExercise
from src.main import app


ML_COURSE_DATA = {
    "course": {
        "title": "机器学习",
        "description": "本课程系统介绍机器学习的基本概念、核心算法和应用实践，涵盖监督学习、无监督学习、强化学习等主要范式，以及模型评估、特征工程、深度学习基础等关键主题。课程注重理论与实践结合，通过丰富的教学案例和编程实验，培养学生运用机器学习方法解决实际问题的能力。",
        "category": "artificial_intelligence",
        "difficulty": "intermediate",
        "duration": "48学时",
        "status": "active",
    },
    "syllabus": {
        "course_code": "CS3210",
        "credit": 3.0,
        "total_hours": 48,
        "theory_hours": 32,
        "practice_hours": 16,
        "semester": "秋季学期",
        "prerequisite_courses": ["高等数学", "线性代数", "概率论与数理统计", "Python程序设计"],
        "course_objectives": [
            "掌握机器学习的基本概念、分类和发展历程",
            "理解监督学习、无监督学习和强化学习的核心算法原理",
            "能够运用特征工程方法对数据进行预处理和特征提取",
            "能够选择合适的模型评估方法并解释评估结果",
            "能够使用Python及主流机器学习框架实现经典算法",
            "具备运用机器学习方法分析和解决实际问题的能力",
        ],
        "assessment_methods": {
            "平时作业": 20,
            "实验报告": 20,
            "期中考试": 20,
            "期末考试": 40,
        },
        "textbook": {
            "title": "机器学习（西瓜书）",
            "author": "周志华",
            "publisher": "清华大学出版社",
            "year": 2016,
            "isbn": "978-7-302-42328-7",
        },
        "references": [
            {"title": "Pattern Recognition and Machine Learning", "author": "Christopher M. Bishop", "publisher": "Springer", "year": 2006},
            {"title": "The Elements of Statistical Learning", "author": "Trevor Hastie, Robert Tibshirani, Jerome Friedman", "publisher": "Springer", "year": 2009},
            {"title": "Deep Learning", "author": "Ian Goodfellow, Yoshua Bengio, Aaron Courville", "publisher": "MIT Press", "year": 2016},
            {"title": "统计学习方法（第2版）", "author": "李航", "publisher": "清华大学出版社", "year": 2019},
        ],
        "description": "机器学习是人工智能领域的核心课程，本课程旨在培养学生系统掌握机器学习的基本理论、典型算法和实践技能，为后续深度学习、自然语言处理等高级课程奠定基础。",
    },
    "chapters": [
        {
            "title": "第1章 机器学习概论",
            "order_index": 1,
            "teaching_hours": 4,
            "chapter_type": "theory",
            "description": "介绍机器学习的基本概念、发展历史、主要分类和应用领域，建立对机器学习全貌的认知。",
            "objectives": ["理解机器学习的定义和基本术语", "了解机器学习的发展历程和主要流派", "掌握机器学习的三大范式：监督学习、无监督学习、强化学习", "了解机器学习的主要应用领域"],
            "key_points": ["机器学习定义", "监督学习与无监督学习的区别", "过拟合与欠拟合", "模型泛化能力"],
            "difficulties": ["过拟合与欠拟合的权衡", "偏差-方差分解"],
            "teaching_methods": ["讲授", "案例分析", "课堂讨论"],
            "knowledge_points": [
                {
                    "title": "机器学习的定义",
                    "order_index": 1,
                    "difficulty_level": "beginner",
                    "importance": "core",
                    "definition": "机器学习是研究如何让计算机在不被显式编程的情况下具备学习能力的学科（Arthur Samuel, 1959）。Tom Mitchell（1997）给出了更形式化的定义：对于一个任务T和性能度量P，如果计算机程序在T上以P衡量的性能随着经验E而提高，则称该程序对任务T从经验E中学习。",
                    "content": "机器学习的核心思想是从数据中自动发现模式和规律，并利用这些规律对未知数据进行预测或决策。与传统的规则驱动编程不同，机器学习通过数据驱动的方式来构建智能系统。\n\n机器学习系统的典型工作流程包括：\n1. 数据收集与预处理\n2. 特征工程\n3. 模型选择与训练\n4. 模型评估与优化\n5. 模型部署与监控",
                    "tags": ["机器学习", "定义", "基础概念"],
                    "source": "周志华《机器学习》",
                    "source_url": "https://cs.nju.edu.cn/zhouzh/zhouzh.files/publication/MLbook2016.htm",
                },
                {
                    "title": "监督学习、无监督学习与强化学习",
                    "order_index": 2,
                    "difficulty_level": "beginner",
                    "importance": "core",
                    "definition": "监督学习是从有标签的训练数据中学习输入到输出的映射关系；无监督学习是从无标签数据中发现隐藏的结构和模式；强化学习是智能体通过与环境交互获得奖励信号来学习最优策略。",
                    "content": "**监督学习（Supervised Learning）**\n- 训练数据包含输入特征和对应的标签（目标值）\n- 分类问题：预测离散标签（如垃圾邮件识别）\n- 回归问题：预测连续值（如房价预测）\n- 常见算法：线性回归、逻辑回归、SVM、决策树、随机森林\n\n**无监督学习（Unsupervised Learning）**\n- 训练数据只有输入特征，没有标签\n- 聚类：将数据分成有意义的组（如客户分群）\n- 降维：减少特征数量同时保留重要信息\n- 常见算法：K-Means、DBSCAN、PCA、自编码器\n\n**强化学习（Reinforcement Learning）**\n- 智能体通过试错与环境交互，最大化累积奖励\n- 核心概念：状态、动作、奖励、策略\n- 常见算法：Q-Learning、SARSA、PPO",
                    "tags": ["监督学习", "无监督学习", "强化学习", "学习范式"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "过拟合与欠拟合",
                    "order_index": 3,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "过拟合是指模型在训练数据上表现很好但在新数据上表现差的现象；欠拟合是指模型连训练数据上的模式都未能学到的现象。",
                    "content": "**过拟合（Overfitting）**\n- 模型过于复杂，记住了训练数据中的噪声\n- 训练误差低，测试误差高\n- 常见原因：模型复杂度过高、训练数据不足、特征过多\n- 解决方法：正则化、增加数据量、特征选择、早停法、Dropout\n\n**欠拟合（Underfitting）**\n- 模型过于简单，无法捕捉数据中的规律\n- 训练误差和测试误差都高\n- 常见原因：模型复杂度不足、特征不足、训练不充分\n- 解决方法：增加模型复杂度、添加特征、减少正则化\n\n**偏差-方差权衡（Bias-Variance Tradeoff）**\n- 总误差 = 偏差² + 方差 + 不可约误差\n- 偏差：模型预测值与真实值的系统性偏差（欠拟合）\n- 方差：模型对不同训练集的敏感程度（过拟合）\n- 理想模型需要在偏差和方差之间取得平衡",
                    "formulas": [
                        {"name": "偏差-方差分解", "formula": "E[(y - f̂(x))²] = Bias²[f̂(x)] + Var[f̂(x)] + σ²", "description": "期望预测误差可分解为偏差的平方、方差和不可约误差之和"},
                    ],
                    "tags": ["过拟合", "欠拟合", "偏差-方差", "模型选择"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "模型评估方法",
                    "order_index": 4,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "模型评估是通过特定方法估计模型泛化性能的过程，包括数据集划分策略和性能度量指标。",
                    "content": "**数据集划分方法**\n1. 留出法（Hold-out）：将数据集分为训练集和测试集\n2. 交叉验证法（K-fold Cross Validation）：将数据分为K个互斥子集，轮流作为测试集\n3. 自助法（Bootstrap）：有放回采样构建训练集\n\n**分类任务指标**\n- 准确率（Accuracy）= (TP+TN) / (TP+TN+FP+FN)\n- 精确率（Precision）= TP / (TP+FP)\n- 召回率（Recall）= TP / (TP+FN)\n- F1值 = 2 × P × R / (P+R)\n- AUC-ROC曲线下面积\n\n**回归任务指标**\n- 均方误差 MSE = (1/n)Σ(yᵢ - ŷᵢ)²\n- 均方根误差 RMSE = √MSE\n- 平均绝对误差 MAE = (1/n)Σ|yᵢ - ŷᵢ|\n- R²决定系数",
                    "formulas": [
                        {"name": "准确率", "formula": "Accuracy = (TP+TN) / (TP+TN+FP+FN)", "description": "分类正确的样本占总样本的比例"},
                        {"name": "F1值", "formula": "F1 = 2PR / (P+R)", "description": "精确率和召回率的调和平均"},
                        {"name": "均方误差", "formula": "MSE = (1/n)Σ(yᵢ - ŷᵢ)²", "description": "预测值与真实值之差的平方的均值"},
                    ],
                    "tags": ["模型评估", "交叉验证", "性能指标", "混淆矩阵"],
                    "source": "周志华《机器学习》",
                },
            ],
            "teaching_cases": [
                {
                    "title": "垃圾邮件分类系统设计",
                    "case_type": "application",
                    "background": "电子邮件服务商需要自动识别垃圾邮件，减少用户受到的骚扰。这是一个典型的二分类问题，需要从邮件内容中提取特征，构建分类模型。",
                    "problem_description": "给定一组已标注的邮件数据（正常邮件和垃圾邮件），设计一个自动分类系统，能够准确识别新邮件是否为垃圾邮件。",
                    "analysis": "1. 数据预处理：去除HTML标签、分词、去除停用词\n2. 特征提取：使用TF-IDF将文本转换为特征向量\n3. 模型选择：可使用朴素贝叶斯、SVM或逻辑回归\n4. 评估指标：由于垃圾邮件占比通常较小，应关注精确率和召回率而非仅看准确率",
                    "solution": "使用朴素贝叶斯分类器：\n1. 对训练集邮件进行分词和TF-IDF特征提取\n2. 训练MultinomialNB分类器\n3. 在测试集上评估，调整阈值平衡精确率和召回率\n4. 使用交叉验证确保模型稳定性",
                    "conclusion": "垃圾邮件分类是机器学习在文本分类领域的经典应用。朴素贝叶斯因其训练速度快、对小数据集表现好而成为首选基线模型。实际部署中还需考虑增量学习、概念漂移等问题。",
                    "code_example": "from sklearn.feature_extraction.text import TfidfVectorizer\nfrom sklearn.naive_bayes import MultinomialNB\nfrom sklearn.model_selection import cross_val_score\nfrom sklearn.metrics import classification_report\n\nvectorizer = TfidfVectorizer(stop_words='english', max_features=5000)\nX_train = vectorizer.fit_transform(train_emails)\nX_test = vectorizer.transform(test_emails)\n\nclf = MultinomialNB(alpha=1.0)\nclf.fit(X_train, y_train)\n\nscores = cross_val_score(clf, X_train, y_train, cv=5, scoring='f1')\nprint(f'Cross-validation F1: {scores.mean():.4f} (+/- {scores.std():.4f})')\n\ny_pred = clf.predict(X_test)\nprint(classification_report(y_test, y_pred, target_names=['Ham', 'Spam']))",
                    "difficulty_level": "beginner",
                    "tags": ["文本分类", "朴素贝叶斯", "TF-IDF", "NLP"],
                    "source": "Scikit-learn文档",
                    "source_url": "https://scikit-learn.org/stable/tutorial/text_analytics/working_with_text_data.html",
                },
            ],
            "exercises": [
                {
                    "title": "机器学习基本概念",
                    "exercise_type": "choice",
                    "difficulty_level": "beginner",
                    "content": "以下关于机器学习的描述，哪个是正确的？",
                    "options": ["机器学习不需要任何数据即可工作", "机器学习是从数据中自动学习模式并做出预测的方法", "机器学习只能处理数值型数据", "机器学习等同于深度学习"],
                    "correct_answer": 1,
                    "answer_analysis": "机器学习的核心是从数据中自动发现模式和规律，并利用这些规律进行预测或决策。选项A错误，数据是机器学习的基础；选项C错误，机器学习可以处理文本、图像等多种类型数据；选项D错误，深度学习只是机器学习的一个子集。",
                    "knowledge_tags": ["机器学习定义", "基本概念"],
                    "score": 5,
                    "estimated_minutes": 3,
                },
                {
                    "title": "监督学习与无监督学习",
                    "exercise_type": "choice",
                    "difficulty_level": "beginner",
                    "content": "以下哪个任务属于无监督学习？",
                    "options": ["根据房屋特征预测房价", "识别图像中的猫和狗", "将客户按消费行为分为不同群体", "判断邮件是否为垃圾邮件"],
                    "correct_answer": 2,
                    "answer_analysis": "客户分群是聚类问题，属于无监督学习，因为事先没有标签信息。A是回归问题，B和D是分类问题，都属于监督学习。",
                    "knowledge_tags": ["监督学习", "无监督学习", "聚类"],
                    "score": 5,
                    "estimated_minutes": 3,
                },
                {
                    "title": "过拟合判断",
                    "exercise_type": "choice",
                    "difficulty_level": "intermediate",
                    "content": "某模型在训练集上准确率达到99%，但在测试集上只有65%，这种现象最可能是：",
                    "options": ["欠拟合", "过拟合", "数据泄露", "模型收敛"],
                    "correct_answer": 1,
                    "answer_analysis": "训练集准确率远高于测试集准确率是过拟合的典型表现。模型过于复杂，记住了训练数据中的噪声和细节，导致泛化能力差。欠拟合的表现是训练集和测试集准确率都很低。",
                    "knowledge_tags": ["过拟合", "泛化能力", "模型评估"],
                    "score": 5,
                    "estimated_minutes": 3,
                },
                {
                    "title": "偏差-方差分解",
                    "exercise_type": "short_answer",
                    "difficulty_level": "advanced",
                    "content": "请解释偏差-方差分解的含义，并说明为什么增加模型复杂度通常会降低偏差但增加方差。",
                    "correct_answer": "偏差-方差分解将模型的期望泛化误差分解为三部分：偏差²+方差+不可约误差。偏差衡量模型预测均值与真实值的偏离程度，反映模型的拟合能力；方差衡量模型对不同训练集的敏感程度，反映模型的稳定性。增加模型复杂度（如增加多项式特征、加深神经网络层数）使模型有更强的拟合能力，能更好地逼近真实函数，从而降低偏差。但同时，更复杂的模型对训练数据中的噪声更敏感，不同的训练集会导致模型参数变化更大，从而增加方差。",
                    "answer_analysis": "偏差-方差权衡是机器学习中模型选择的核心问题。理解这一点对于选择合适的模型复杂度至关重要。",
                    "knowledge_tags": ["偏差-方差", "模型选择", "泛化误差"],
                    "score": 10,
                    "estimated_minutes": 10,
                },
            ],
        },
        {
            "title": "第2章 线性模型",
            "order_index": 2,
            "teaching_hours": 6,
            "chapter_type": "theory",
            "description": "介绍线性回归和逻辑回归两种基本线性模型，包括模型形式、参数估计方法和正则化技术。",
            "objectives": ["掌握线性回归的模型形式和最小二乘估计", "理解逻辑回归的原理和最大似然估计", "掌握正则化方法（L1、L2）及其作用", "能够使用线性模型解决回归和分类问题"],
            "key_points": ["线性回归", "逻辑回归", "最小二乘法", "正则化"],
            "difficulties": ["最大似然估计推导", "L1正则化产生稀疏解的原理", "多分类策略"],
            "teaching_methods": ["讲授", "推导", "编程实验"],
            "knowledge_points": [
                {
                    "title": "线性回归",
                    "order_index": 1,
                    "difficulty_level": "beginner",
                    "importance": "core",
                    "definition": "线性回归是利用线性函数对自变量和因变量之间的关系进行建模的方法，目标是最小化预测值与真实值之间的均方误差。",
                    "content": "**模型形式**\nf(x) = w₁x₁ + w₂x₂ + ... + wₙxₙ + b\n\n用向量表示：f(x) = wᵀx + b\n\n**参数估计——最小二乘法**\n目标：最小化均方误差 J(w,b) = Σ(yᵢ - (wᵀxᵢ+b))²\n\n对w和b求偏导并令其为零，可得解析解：\nw* = (XᵀX)⁻¹Xᵀy\n\n**梯度下降法**\n当数据量大或XᵀX不可逆时，使用梯度下降迭代优化：\nw ← w - α·∂J/∂w\nb ← b - α·∂J/∂b\n其中α是学习率。",
                    "formulas": [
                        {"name": "线性回归模型", "formula": "f(x) = wᵀx + b", "description": "线性回归的预测函数"},
                        {"name": "最小二乘解析解", "formula": "w* = (XᵀX)⁻¹Xᵀy", "description": "当XᵀX可逆时的闭式解"},
                        {"name": "均方误差损失", "formula": "J(w,b) = (1/2n)Σ(yᵢ - (wᵀxᵢ+b))²", "description": "线性回归的优化目标"},
                    ],
                    "tags": ["线性回归", "最小二乘法", "梯度下降"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "逻辑回归",
                    "order_index": 2,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "逻辑回归是一种广义线性分类模型，通过Sigmoid函数将线性组合映射到[0,1]区间，输出样本属于正类的概率。",
                    "content": "**Sigmoid函数**\nσ(z) = 1 / (1 + e⁻ᶻ)\n\n**模型形式**\nP(y=1|x) = σ(wᵀx + b) = 1 / (1 + e⁻⁽ʷᵀˣ⁺ᵇ⁾)\n\n**参数估计——最大似然估计**\n对数似然函数：\nL(w,b) = Σ[yᵢlog(pᵢ) + (1-yᵢ)log(1-pᵢ)]\n\n等价于最小化交叉熵损失：\nJ(w,b) = -Σ[yᵢlog(pᵢ) + (1-yᵢ)log(1-pᵢ)]\n\n**决策边界**\n当P(y=1|x) ≥ 0.5时，预测为正类，此时wᵀx + b ≥ 0\n逻辑回归的决策边界是线性的。",
                    "formulas": [
                        {"name": "Sigmoid函数", "formula": "σ(z) = 1 / (1 + e⁻ᶻ)", "description": "将任意实数映射到(0,1)区间"},
                        {"name": "交叉熵损失", "formula": "J = -Σ[yᵢlog(pᵢ) + (1-yᵢ)log(1-pᵢ)]", "description": "逻辑回归的优化目标"},
                    ],
                    "tags": ["逻辑回归", "Sigmoid", "交叉熵", "分类"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "正则化",
                    "order_index": 3,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "正则化是在损失函数中加入惩罚项来限制模型复杂度，防止过拟合的技术。",
                    "content": "**L2正则化（Ridge回归）**\n损失函数：J_reg = J(w,b) + (λ/2n)Σwⱼ²\n- 使权重趋向较小的值，但不为零\n- 等价于对权重施加高斯先验\n- 解析解：w* = (XᵀX + λI)⁻¹Xᵀy\n\n**L1正则化（Lasso回归）**\n损失函数：J_reg = J(w,b) + (λ/n)Σ|wⱼ|\n- 产生稀疏解，部分权重恰好为零\n- 具有特征选择的效果\n- 等价于对权重施加拉普拉斯先验\n\n**弹性网络（Elastic Net）**\n结合L1和L2正则化：\nJ_reg = J(w,b) + (λ₁/n)Σ|wⱼ| + (λ₂/2n)Σwⱼ²\n\n**正则化参数λ的选择**\n- λ过小：正则化效果弱，可能过拟合\n- λ过大：模型过于简单，可能欠拟合\n- 通常通过交叉验证选择最优λ",
                    "formulas": [
                        {"name": "L2正则化", "formula": "J_reg = J(w) + (λ/2n)||w||²", "description": "Ridge回归的损失函数"},
                        {"name": "L1正则化", "formula": "J_reg = J(w) + (λ/n)||w||₁", "description": "Lasso回归的损失函数"},
                    ],
                    "tags": ["正则化", "L1正则化", "L2正则化", "过拟合"],
                    "source": "周志华《机器学习》",
                },
            ],
            "teaching_cases": [
                {
                    "title": "波士顿房价预测",
                    "case_type": "application",
                    "background": "房价预测是回归问题的经典案例。给定房屋的各种特征（面积、房间数、地段等），预测房屋的价格。",
                    "problem_description": "使用线性回归模型，基于房屋特征数据预测房价，并比较不同正则化方法的效果。",
                    "analysis": "1. 数据探索：分析特征分布和相关性\n2. 特征标准化：消除量纲影响\n3. 基线模型：普通线性回归\n4. 对比实验：Ridge和Lasso正则化\n5. 交叉验证选择最优正则化参数",
                    "solution": "使用scikit-learn实现：\n1. StandardScaler标准化特征\n2. 训练LinearRegression、Ridge、Lasso\n3. 使用GridSearchCV搜索最优alpha\n4. 比较RMSE和R²指标",
                    "conclusion": "正则化能有效防止过拟合。Lasso可以产生稀疏解实现特征选择，Ridge适合特征间存在共线性的情况。实际应用中通常需要交叉验证选择正则化类型和强度。",
                    "code_example": "from sklearn.linear_model import Ridge, Lasso\nfrom sklearn.preprocessing import StandardScaler\nfrom sklearn.model_selection import GridSearchCV\nfrom sklearn.metrics import mean_squared_error, r2_score\nimport numpy as np\n\nscaler = StandardScaler()\nX_train_scaled = scaler.fit_transform(X_train)\nX_test_scaled = scaler.transform(X_test)\n\nridge_params = {'alpha': [0.01, 0.1, 1, 10, 100]}\nridge_cv = GridSearchCV(Ridge(), ridge_params, cv=5, scoring='neg_mean_squared_error')\nridge_cv.fit(X_train_scaled, y_train)\n\ny_pred = ridge_cv.predict(X_test_scaled)\nrmse = np.sqrt(mean_squared_error(y_test, y_pred))\nr2 = r2_score(y_test, y_pred)\nprint(f'Best alpha: {ridge_cv.best_params_[\"alpha\"]}')\nprint(f'RMSE: {rmse:.4f}, R²: {r2:.4f}')",
                    "difficulty_level": "intermediate",
                    "tags": ["线性回归", "正则化", "Ridge", "Lasso", "房价预测"],
                    "source": "Scikit-learn文档",
                    "source_url": "https://scikit-learn.org/stable/modules/linear_model.html",
                },
            ],
            "exercises": [
                {
                    "title": "线性回归解析解",
                    "exercise_type": "choice",
                    "difficulty_level": "intermediate",
                    "content": "线性回归中，当设计矩阵X的列向量线性相关时，最小二乘法的解析解w*=(XᵀX)⁻¹Xᵀy会怎样？",
                    "options": ["仍然可以正常计算", "XᵀX不可逆，解析解不存在", "需要使用伪逆代替", "B和C都正确"],
                    "correct_answer": 3,
                    "answer_analysis": "当X的列向量线性相关时，XᵀX不可逆，标准解析解不存在。此时可以使用Moore-Penrose伪逆X⁺来求解，w*=X⁺y，这给出了最小范数解。所以B和C都正确。",
                    "knowledge_tags": ["线性回归", "最小二乘法", "矩阵求逆"],
                    "score": 5,
                    "estimated_minutes": 5,
                },
                {
                    "title": "逻辑回归决策边界",
                    "exercise_type": "choice",
                    "difficulty_level": "intermediate",
                    "content": "逻辑回归的决策边界是什么形状？",
                    "options": ["曲线", "超平面", "圆形", "取决于数据分布"],
                    "correct_answer": 1,
                    "answer_analysis": "逻辑回归的决策边界是wᵀx+b=0，这是一个线性超平面。虽然Sigmoid函数是非线性的，但它只对输出做非线性变换，决策边界仍然由线性函数决定。因此逻辑回归是线性分类器。",
                    "knowledge_tags": ["逻辑回归", "决策边界", "线性分类器"],
                    "score": 5,
                    "estimated_minutes": 3,
                },
                {
                    "title": "L1与L2正则化比较",
                    "exercise_type": "short_answer",
                    "difficulty_level": "advanced",
                    "content": "请从几何角度解释为什么L1正则化更容易产生稀疏解，而L2正则化不会。",
                    "correct_answer": "从几何角度看，L1正则化的约束区域是菱形（在二维情况下），L2正则化的约束区域是圆形。当损失函数的等高线与约束区域相交时，L1的菱形顶点更容易与等高线相切，而顶点恰好位于坐标轴上（即某些权重为零），因此更容易产生稀疏解。L2的圆形边界没有这样的角点，相切点不太可能出现在坐标轴上，因此不会产生恰好为零的权重。",
                    "answer_analysis": "几何解释是理解L1稀疏性最直观的方式。也可以从贝叶斯角度理解：L1对应拉普拉斯先验（在零点有尖峰），L2对应高斯先验（在零点平滑）。",
                    "knowledge_tags": ["L1正则化", "L2正则化", "稀疏解", "特征选择"],
                    "score": 10,
                    "estimated_minutes": 8,
                },
            ],
        },
        {
            "title": "第3章 决策树",
            "order_index": 3,
            "teaching_hours": 4,
            "chapter_type": "theory",
            "description": "介绍决策树的基本原理、划分选择标准（信息增益、增益率、基尼指数）和剪枝策略。",
            "objectives": ["理解决策树的基本思想和构建过程", "掌握信息增益、增益率和基尼指数三种划分标准", "理解决策树的剪枝策略", "了解CART、ID3、C4.5算法的区别"],
            "key_points": ["信息熵", "信息增益", "基尼指数", "剪枝"],
            "difficulties": ["信息增益偏向多值属性的问题", "预剪枝与后剪枝的权衡", "连续值与缺失值处理"],
            "teaching_methods": ["讲授", "实例演示", "编程实验"],
            "knowledge_points": [
                {
                    "title": "信息熵与信息增益",
                    "order_index": 1,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "信息熵是度量样本集合纯度最常用的指标，信息增益表示得知某属性的信息而使得类的不确定性减少的程度。",
                    "content": "**信息熵**\nEnt(D) = -Σpₖlog₂pₖ\n其中pₖ是第k类样本所占比例。Ent(D)越小，D的纯度越高。\n\n**信息增益**\nGain(D,a) = Ent(D) - Σ(|Dᵛ|/|D|)Ent(Dᵛ)\n其中Dᵛ是属性a上取值为v的样本子集。\n\n**信息增益率（C4.5）**\nGain_ratio(D,a) = Gain(D,a) / IV(a)\nIV(a) = -Σ(|Dᵛ|/|D|)log₂(|Dᵛ|/|D|)称为属性a的固有值。\n\n**基尼指数（CART）**\nGini(D) = 1 - Σpₖ²\nGini_index(D,a) = Σ(|Dᵛ|/|D|)Gini(Dᵛ)\n选择使基尼指数最小的属性作为划分属性。",
                    "formulas": [
                        {"name": "信息熵", "formula": "Ent(D) = -Σpₖlog₂pₖ", "description": "度量集合D的不确定性"},
                        {"name": "信息增益", "formula": "Gain(D,a) = Ent(D) - Σ(|Dᵛ|/|D|)Ent(Dᵛ)", "description": "属性a带来的信息减少量"},
                        {"name": "基尼指数", "formula": "Gini(D) = 1 - Σpₖ²", "description": "从数据集中随机抽取两个样本类别不一致的概率"},
                    ],
                    "tags": ["信息熵", "信息增益", "基尼指数", "决策树"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "决策树剪枝",
                    "order_index": 2,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "剪枝是决策树对付过拟合的主要手段，通过去掉部分分支来降低模型复杂度，提高泛化能力。",
                    "content": "**预剪枝（Pre-pruning）**\n- 在决策树生成过程中，对每个节点在划分前进行估计\n- 若当前节点的划分不能带来泛化性能提升，则停止划分\n- 优点：训练时间短，模型简单\n- 缺点：可能欠拟合，有贪心策略的局限性\n\n**后剪枝（Post-pruning）**\n- 先从训练集生成完整的决策树，然后自底向上对非叶节点进行考察\n- 若将该节点对应的子树替换为叶节点能带来泛化性能提升，则进行替换\n- 优点：保留了更多分支，欠拟合风险小\n- 缺点：训练时间较长\n\n**常见后剪枝方法**\n- 降低错误剪枝（REP）\n- 悲观错误剪枝（PEP）\n- 代价复杂度剪枝（CCP）",
                    "tags": ["决策树", "剪枝", "过拟合", "预剪枝", "后剪枝"],
                    "source": "周志华《机器学习》",
                },
            ],
            "teaching_cases": [
                {
                    "title": "鸢尾花分类",
                    "case_type": "demonstration",
                    "background": "鸢尾花数据集是模式识别和机器学习领域最著名的数据集之一，包含3种鸢尾花各50个样本，每个样本有4个特征。",
                    "problem_description": "使用决策树对鸢尾花进行分类，比较不同划分标准和剪枝策略的效果。",
                    "analysis": "1. 数据集包含4个数值特征：花萼长度、花萼宽度、花瓣长度、花瓣宽度\n2. 三类鸢尾花：Setosa、Versicolor、Virginica\n3. Setosa线性可分，其余两类有部分重叠\n4. 决策树可提供直观的分类规则",
                    "solution": "使用scikit-learn的DecisionTreeClassifier，分别设置criterion='entropy'和criterion='gini'，配合max_depth限制树深度实现预剪枝。",
                    "conclusion": "决策树在鸢尾花数据集上表现良好，能产生易于理解的分类规则。花瓣特征对分类贡献最大，决策树自动选择了这些特征作为顶层划分。",
                    "code_example": "from sklearn.datasets import load_iris\nfrom sklearn.tree import DecisionTreeClassifier, plot_tree\nfrom sklearn.model_selection import cross_val_score\nimport matplotlib.pyplot as plt\n\niris = load_iris()\nclf = DecisionTreeClassifier(criterion='entropy', max_depth=3, random_state=42)\nscores = cross_val_score(clf, iris.data, iris.target, cv=5)\nprint(f'Accuracy: {scores.mean():.4f} (+/- {scores.std():.4f})')\n\nclf.fit(iris.data, iris.target)\nplt.figure(figsize=(12,8))\nplot_tree(clf, feature_names=iris.feature_names, class_names=iris.target_names, filled=True)\nplt.savefig('iris_tree.png')",
                    "difficulty_level": "beginner",
                    "tags": ["决策树", "分类", "可视化", "鸢尾花"],
                    "source": "Scikit-learn文档",
                    "source_url": "https://scikit-learn.org/stable/modules/tree.html",
                },
            ],
            "exercises": [
                {
                    "title": "信息增益计算",
                    "exercise_type": "calculation",
                    "difficulty_level": "intermediate",
                    "content": "给定一个包含10个样本的数据集，其中6个正例、4个反例。属性A将数据集分为两个子集：D1包含4个正例和1个反例，D2包含2个正例和3个反例。请计算属性A的信息增益。",
                    "correct_answer": "Ent(D) = -(6/10)log₂(6/10) - (4/10)log₂(4/10) ≈ 0.971\nEnt(D1) = -(4/5)log₂(4/5) - (1/5)log₂(1/5) ≈ 0.722\nEnt(D2) = -(2/5)log₂(2/5) - (3/5)log₂(3/5) ≈ 0.971\nGain(D,A) = 0.971 - (5/10)×0.722 - (5/10)×0.971 ≈ 0.971 - 0.361 - 0.486 = 0.125",
                    "answer_analysis": "信息增益的计算步骤：1)计算父节点的熵；2)计算各子节点的熵；3)用子节点熵的加权平均减去父节点熵。信息增益越大，说明该属性的划分效果越好。",
                    "knowledge_tags": ["信息熵", "信息增益", "决策树"],
                    "score": 10,
                    "estimated_minutes": 10,
                },
                {
                    "title": "决策树算法比较",
                    "exercise_type": "choice",
                    "difficulty_level": "intermediate",
                    "content": "以下关于ID3、C4.5和CART算法的描述，哪个是错误的？",
                    "options": ["ID3使用信息增益作为划分标准", "C4.5使用信息增益率来克服信息增益偏向多值属性的问题", "CART只能用于分类任务，不能用于回归", "CART生成的是二叉树"],
                    "correct_answer": 2,
                    "answer_analysis": "CART不仅可以用于分类（使用基尼指数），也可以用于回归（使用平方误差最小化）。选项C的描述是错误的。ID3使用信息增益、C4.5使用增益率、CART使用基尼指数，CART确实生成二叉树。",
                    "knowledge_tags": ["ID3", "C4.5", "CART", "决策树算法"],
                    "score": 5,
                    "estimated_minutes": 4,
                },
            ],
        },
        {
            "title": "第4章 支持向量机",
            "order_index": 4,
            "teaching_hours": 6,
            "chapter_type": "theory",
            "description": "介绍支持向量机的最大间隔思想、对偶问题求解、核函数方法和软间隔处理。",
            "objectives": ["理解SVM的最大间隔原理", "掌握对偶问题的推导和KKT条件", "理解核函数的作用和常见核函数", "掌握软间隔SVM和正则化参数C的作用"],
            "key_points": ["最大间隔", "对偶问题", "核函数", "软间隔"],
            "difficulties": ["对偶问题推导", "KKT条件", "核函数选择"],
            "teaching_methods": ["讲授", "数学推导", "编程实验"],
            "knowledge_points": [
                {
                    "title": "最大间隔与支持向量",
                    "order_index": 1,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "SVM寻找能在特征空间中找到将不同类别的样本分开的超平面，且使得离超平面最近的样本点（支持向量）到超平面的距离最大。",
                    "content": "**硬间隔SVM优化问题**\nmin ½||w||²\ns.t. yᵢ(wᵀxᵢ+b) ≥ 1, i=1,...,n\n\n**间隔**\nγ = 2/||w||\n最大化间隔等价于最小化||w||²\n\n**支持向量**\n满足yᵢ(wᵀxᵢ+b)=1的训练样本点称为支持向量\n它们决定了分类超平面，移除非支持向量不影响模型\n\n**对偶问题**\nmax Σαᵢ - ½ΣΣαᵢαⱼyᵢyⱼxᵢᵀxⱼ\ns.t. Σαᵢyᵢ=0, αᵢ≥0\n\n决策函数：f(x) = Σαᵢyᵢxᵢᵀx + b",
                    "formulas": [
                        {"name": "SVM优化目标", "formula": "min ½||w||² s.t. yᵢ(wᵀxᵢ+b)≥1", "description": "最大化间隔等价于最小化权重范数"},
                        {"name": "间隔", "formula": "γ = 2/||w||", "description": "分类间隔的宽度"},
                    ],
                    "tags": ["SVM", "最大间隔", "支持向量", "对偶问题"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "核函数",
                    "order_index": 2,
                    "difficulty_level": "advanced",
                    "importance": "core",
                    "definition": "核函数是映射函数的内积，K(x,z)=φ(x)ᵀφ(z)，它允许在原始特征空间中计算高维特征空间的内积，从而实现非线性分类。",
                    "content": "**核技巧**\n在对偶问题中，样本仅以内积xᵢᵀxⱼ的形式出现\n用核函数K(xᵢ,xⱼ)替换内积，即可隐式地在高维空间中分类\n\n**常见核函数**\n1. 线性核：K(x,z) = xᵀz\n2. 多项式核：K(x,z) = (xᵀz + c)ᵈ\n3. 高斯核(RBF)：K(x,z) = exp(-||x-z||²/2σ²)\n4. Sigmoid核：K(x,z) = tanh(αxᵀz + c)\n\n**Mercer定理**\n核函数K有效的充要条件是对任意有限集，核矩阵半正定。\n\n**核函数选择**\n- 线性核：特征维度高、样本少\n- RBF核：通用性强，最常用\n- 多项式核：特征间有明确交互关系",
                    "formulas": [
                        {"name": "高斯核(RBF)", "formula": "K(x,z) = exp(-||x-z||²/2σ²)", "description": "最常用的核函数，σ控制影响范围"},
                    ],
                    "tags": ["核函数", "核技巧", "RBF", "非线性分类"],
                    "source": "周志华《机器学习》",
                },
            ],
            "teaching_cases": [
                {
                    "title": "手写数字识别",
                    "case_type": "application",
                    "background": "手写数字识别是模式识别的经典问题，需要从8×8的灰度图像中识别0-9的数字。",
                    "problem_description": "使用SVM对手写数字数据集进行分类，比较不同核函数和参数的效果。",
                    "analysis": "1. 数据集：8×8灰度图像，64维特征\n2. 多分类策略：一对多(OvR)或一对一(OvO)\n3. 核函数选择：线性核 vs RBF核\n4. 参数调优：C和gamma的网格搜索",
                    "solution": "使用GridSearchCV搜索最优C和gamma参数，对比线性核和RBF核的分类效果。",
                    "conclusion": "RBF核在数字识别任务上通常优于线性核，因为数字图像的分类边界是非线性的。适当的参数选择对SVM性能至关重要。",
                    "code_example": "from sklearn import datasets, svm\nfrom sklearn.model_selection import GridSearchCV, train_test_split\n\ndigits = datasets.load_digits()\nX_train, X_test, y_train, y_test = train_test_split(digits.data, digits.target, test_size=0.3)\n\nparam_grid = {'C': [0.1, 1, 10, 100], 'gamma': [0.001, 0.01, 0.1, 1]}\nclf = GridSearchCV(svm.SVC(kernel='rbf'), param_grid, cv=5)\nclf.fit(X_train, y_train)\nprint(f'Best params: {clf.best_params_}')\nprint(f'Test accuracy: {clf.score(X_test, y_test):.4f}')",
                    "difficulty_level": "intermediate",
                    "tags": ["SVM", "手写数字", "RBF核", "参数调优"],
                    "source": "Scikit-learn文档",
                    "source_url": "https://scikit-learn.org/stable/auto_examples/classification/plot_digits_classification.html",
                },
            ],
            "exercises": [
                {
                    "title": "SVM间隔计算",
                    "exercise_type": "choice",
                    "difficulty_level": "intermediate",
                    "content": "在二维空间中，SVM的分类超平面为2x₁+3x₂-6=0，则分类间隔为：",
                    "options": ["1/√13", "2/√13", "12/√13", "6/√13"],
                    "correct_answer": 2,
                    "answer_analysis": "间隔γ=2/||w||，其中w=(2,3)，||w||=√(4+9)=√13，所以γ=2/√13。注意SVM中间隔的定义是2/||w||，不是1/||w||。",
                    "knowledge_tags": ["SVM", "间隔", "超平面"],
                    "score": 5,
                    "estimated_minutes": 5,
                },
                {
                    "title": "核函数理解",
                    "exercise_type": "choice",
                    "difficulty_level": "advanced",
                    "content": "关于核函数，以下说法错误的是：",
                    "options": ["核函数可以隐式地将数据映射到高维空间", "核函数必须满足Mercer条件才能保证优化问题有解", "使用核函数的SVM等价于先显式映射到高维空间再分类", "高斯核可以将数据映射到无穷维空间"],
                    "correct_answer": 2,
                    "answer_analysis": "核技巧的核心优势就是不需要显式地计算高维映射φ(x)，而是通过核函数K(x,z)=φ(x)ᵀφ(z)直接计算内积。所以选项C说\"等价于先显式映射\"在计算意义上是错误的——核技巧避免了显式映射的高维计算。虽然数学上等价，但计算方式完全不同。",
                    "knowledge_tags": ["核函数", "核技巧", "Mercer条件"],
                    "score": 5,
                    "estimated_minutes": 5,
                },
            ],
        },
        {
            "title": "第5章 神经网络基础",
            "order_index": 5,
            "teaching_hours": 6,
            "chapter_type": "theory",
            "description": "介绍人工神经元模型、多层前馈网络、反向传播算法和深度学习基础。",
            "objectives": ["理解感知机和多层前馈网络的结构", "掌握反向传播算法的原理", "了解常见的激活函数及其特点", "理解深度学习中的优化技巧"],
            "key_points": ["感知机", "反向传播", "激活函数", "梯度消失"],
            "difficulties": ["反向传播的链式法则推导", "梯度消失与梯度爆炸", "优化器选择"],
            "teaching_methods": ["讲授", "推导", "编程实验"],
            "knowledge_points": [
                {
                    "title": "感知机与多层网络",
                    "order_index": 1,
                    "difficulty_level": "beginner",
                    "importance": "core",
                    "definition": "感知机是最简单的前馈神经网络，由输入层和输出层组成。多层前馈网络（MLP）包含输入层、一个或多个隐藏层和输出层。",
                    "content": "**单层感知机**\ny = f(wᵀx + b)\nf为阶跃函数或符号函数\n\n**XOR问题**\n单层感知机只能解决线性可分问题\n无法解决XOR等非线性问题（Minsky & Papert, 1969）\n\n**多层前馈网络**\n- 输入层：接收特征\n- 隐藏层：提取特征表示\n- 输出层：输出预测结果\n- 每层神经元与下一层全连接\n\n**万能近似定理**\n具有足够多隐藏神经元的单隐藏层前馈网络可以近似任意连续函数",
                    "tags": ["感知机", "多层前馈网络", "XOR问题", "万能近似定理"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "反向传播算法",
                    "order_index": 2,
                    "difficulty_level": "advanced",
                    "importance": "core",
                    "definition": "反向传播（Backpropagation, BP）算法是训练神经网络的核心算法，利用链式法则高效计算损失函数对各层参数的梯度。",
                    "content": "**前向传播**\n逐层计算：hₗ = f(Wₗhₗ₋₁ + bₗ)\n\n**损失函数**\n回归：MSE = (1/n)Σ(yᵢ - ŷᵢ)²\n分类：交叉熵 = -Σyᵢlog(ŷᵢ)\n\n**反向传播**\n利用链式法则从输出层向输入层逐层计算梯度：\n∂L/∂Wₗ = (∂L/∂hₗ)·(∂hₗ/∂Wₗ)\nδₗ = (∂L/∂hₗ)·f'(zₗ)  （误差信号）\nδₗ = (Wₗ₊₁ᵀδₗ₊₁) ⊙ f'(zₗ)  （递推公式）\n\n**参数更新**\nWₗ ← Wₗ - η·∂L/∂Wₗ\nbₗ ← bₗ - η·∂L/∂bₗ",
                    "formulas": [
                        {"name": "误差信号递推", "formula": "δₗ = (Wₗ₊₁ᵀδₗ₊₁) ⊙ f'(zₗ)", "description": "从后向前递推计算各层误差信号"},
                    ],
                    "tags": ["反向传播", "链式法则", "梯度计算", "神经网络训练"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "激活函数",
                    "order_index": 3,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "激活函数引入非线性变换，使神经网络能够学习复杂的非线性映射关系。",
                    "content": "**Sigmoid**\nσ(x) = 1/(1+e⁻ˣ)\n- 输出范围(0,1)，可解释为概率\n- 缺点：梯度消失、非零中心、计算exp较慢\n\n**Tanh**\ntanh(x) = (eˣ-e⁻ˣ)/(eˣ+e⁻ˣ)\n- 输出范围(-1,1)，零中心\n- 仍有梯度消失问题\n\n**ReLU**\nReLU(x) = max(0,x)\n- 计算简单，缓解梯度消失\n- 缺点：神经元死亡（Dead ReLU）\n\n**Leaky ReLU**\nLeakyReLU(x) = max(αx,x)，α通常取0.01\n- 解决Dead ReLU问题\n\n**Softmax（多分类输出层）**\nsoftmax(zᵢ) = eᶻⁱ/Σeᶻʲ\n- 输出为概率分布，所有输出之和为1",
                    "tags": ["激活函数", "ReLU", "Sigmoid", "Softmax"],
                    "source": "周志华《机器学习》",
                },
            ],
            "teaching_cases": [
                {
                    "title": "MNIST手写数字识别",
                    "case_type": "experiment",
                    "background": "MNIST是深度学习领域的Hello World数据集，包含60000个训练样本和10000个测试样本的28×28灰度手写数字图像。",
                    "problem_description": "使用多层感知机对MNIST数据集进行分类，探索不同网络结构和训练策略的影响。",
                    "analysis": "1. 输入：784维向量（28×28展平）\n2. 输出：10类（0-9）\n3. 网络结构：784→256→128→10\n4. 激活函数：隐藏层ReLU，输出层Softmax\n5. 优化器：Adam，学习率0.001\n6. 正则化：Dropout(0.2)",
                    "solution": "使用PyTorch或TensorFlow构建MLP，训练并评估模型性能。",
                    "conclusion": "简单的MLP在MNIST上可达到97-98%的准确率。CNN可以进一步提升到99%以上。关键因素：ReLU激活、Batch Normalization、Dropout、Adam优化器。",
                    "code_example": "import torch\nimport torch.nn as nn\n\nclass MLP(nn.Module):\n    def __init__(self):\n        super().__init__()\n        self.net = nn.Sequential(\n            nn.Flatten(),\n            nn.Linear(784, 256),\n            nn.ReLU(),\n            nn.Dropout(0.2),\n            nn.Linear(256, 128),\n            nn.ReLU(),\n            nn.Dropout(0.2),\n            nn.Linear(128, 10),\n        )\n    def forward(self, x):\n        return self.net(x)\n\nmodel = MLP()\noptimizer = torch.optim.Adam(model.parameters(), lr=0.001)\ncriterion = nn.CrossEntropyLoss()",
                    "difficulty_level": "intermediate",
                    "tags": ["神经网络", "MNIST", "PyTorch", "深度学习"],
                    "source": "PyTorch教程",
                    "source_url": "https://pytorch.org/tutorials/beginner/basics/quickstart_tutorial.html",
                },
            ],
            "exercises": [
                {
                    "title": "XOR问题",
                    "exercise_type": "choice",
                    "difficulty_level": "intermediate",
                    "content": "单层感知机无法解决XOR问题的根本原因是：",
                    "options": ["感知机的激活函数是阶跃函数", "XOR问题不是线性可分的", "感知机的学习率设置不当", "感知机的权重初始化不正确"],
                    "correct_answer": 1,
                    "answer_analysis": "单层感知机只能产生线性决策边界。XOR问题的正负类样本无法用一条直线分开（不是线性可分的），因此单层感知机无法解决。解决XOR问题需要引入隐藏层，即使用多层网络。",
                    "knowledge_tags": ["感知机", "XOR", "线性可分"],
                    "score": 5,
                    "estimated_minutes": 3,
                },
                {
                    "title": "梯度消失",
                    "exercise_type": "short_answer",
                    "difficulty_level": "advanced",
                    "content": "请解释为什么Sigmoid激活函数会导致梯度消失问题，以及ReLU如何缓解这个问题。",
                    "correct_answer": "Sigmoid函数的导数为σ'(x)=σ(x)(1-σ(x))，最大值仅为0.25。在反向传播中，梯度通过链式法则逐层相乘，当网络层数较多时，多个小于1的梯度相乘会导致梯度指数级衰减，靠近输入层的梯度几乎为零，这就是梯度消失。ReLU的导数在正区间恒为1，不衰减，因此梯度可以有效地传播到浅层，缓解了梯度消失问题。但ReLU在负区间导数为0，可能导致神经元死亡。",
                    "answer_analysis": "梯度消失是深度神经网络训练的核心挑战之一。理解其成因对于选择合适的激活函数和网络结构至关重要。",
                    "knowledge_tags": ["梯度消失", "激活函数", "Sigmoid", "ReLU"],
                    "score": 10,
                    "estimated_minutes": 8,
                },
            ],
        },
        {
            "title": "第6章 集成学习",
            "order_index": 6,
            "teaching_hours": 4,
            "chapter_type": "theory",
            "description": "介绍集成学习的基本思想、Bagging和Boosting两大框架，以及随机森林、AdaBoost、GBDT等经典算法。",
            "objectives": ["理解集成学习的基本思想和多样性原则", "掌握Bagging和Boosting的区别", "理解随机森林的原理和优势", "掌握AdaBoost和GBDT算法"],
            "key_points": ["Bagging", "Boosting", "随机森林", "AdaBoost"],
            "difficulties": ["Boosting的加法模型推导", "GBDT的梯度下降思想", "偏差-方差视角理解集成方法"],
            "teaching_methods": ["讲授", "对比分析", "编程实验"],
            "knowledge_points": [
                {
                    "title": "Bagging与随机森林",
                    "order_index": 1,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "Bagging通过对训练集进行有放回采样（Bootstrap）产生多个子集，分别训练基学习器，最后对预测结果进行投票或平均。随机森林是Bagging的扩展，在训练决策树时还随机选择特征子集。",
                    "content": "**Bagging算法**\n1. 对训练集进行m次Bootstrap采样，得到m个子集\n2. 在每个子集上训练一个基学习器\n3. 分类任务投票，回归任务平均\n\n**随机森林（Random Forest）**\n在Bagging基础上增加特征随机性：\n- 每棵树训练时，每个节点从d个特征中随机选择k个（k≤d）\n- 通常k=log₂d或k=√d\n- 进一步降低基学习器的相关性\n\n**OOB估计**\n使用未参与训练的样本（袋外样本）进行估计\n无需额外划分验证集",
                    "tags": ["Bagging", "随机森林", "Bootstrap", "集成学习"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "Boosting与AdaBoost",
                    "order_index": 2,
                    "difficulty_level": "advanced",
                    "importance": "core",
                    "definition": "Boosting是一族可将弱学习器提升为强学习器的算法，通过串行训练基学习器，每个后续学习器重点关注前序学习器犯错的样本。AdaBoost是Boosting的代表算法。",
                    "content": "**AdaBoost算法**\n1. 初始化样本权重wᵢ=1/N\n2. 对t=1,...,T:\n   a. 用加权训练集训练基学习器hₜ\n   b. 计算加权错误率εₜ\n   c. 计算学习器权重αₜ = ½ln((1-εₜ)/εₜ)\n   d. 更新样本权重：正确分类的样本权重降低，错误分类的样本权重增加\n3. 最终分类器：H(x) = sign(Σαₜhₜ(x))\n\n**GBDT（梯度提升决策树）**\n- 使用决策树作为基学习器\n- 每棵树拟合前一轮的残差（负梯度）\n- 通过学习率控制每棵树的贡献\n- 可用于分类和回归",
                    "formulas": [
                        {"name": "AdaBoost学习器权重", "formula": "αₜ = ½ln((1-εₜ)/εₜ)", "description": "错误率越低的学习器权重越大"},
                    ],
                    "tags": ["Boosting", "AdaBoost", "GBDT", "集成学习"],
                    "source": "周志华《机器学习》",
                },
            ],
            "teaching_cases": [
                {
                    "title": "客户流失预测",
                    "case_type": "project",
                    "background": "电信公司需要预测哪些客户可能流失，以便提前采取挽留措施。这是一个典型的二分类问题，特征包括客户使用行为、账户信息等。",
                    "problem_description": "使用随机森林和GBDT对客户流失进行预测，比较两种集成方法的效果。",
                    "analysis": "1. 数据不平衡：流失客户通常占少数\n2. 特征类型混合：数值型和类别型\n3. 评估指标：关注召回率和AUC，而非仅看准确率\n4. 可解释性：业务需要理解哪些因素影响流失",
                    "solution": "1. 数据预处理：缺失值填充、类别编码、特征标准化\n2. 使用SMOTE处理类别不平衡\n3. 训练随机森林和GBDT模型\n4. 对比AUC、精确率-召回率曲线\n5. 使用特征重要性分析关键因素",
                    "conclusion": "GBDT通常在客户流失预测上略优于随机森林，但随机森林更易调参且训练更快。特征重要性分析显示，客户使用时长、月消费额和投诉次数是影响流失的关键因素。",
                    "code_example": "from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier\nfrom sklearn.metrics import roc_auc_score, classification_report\n\nrf = RandomForestClassifier(n_estimators=200, max_depth=10, class_weight='balanced', random_state=42)\ngbdt = GradientBoostingClassifier(n_estimators=200, max_depth=5, learning_rate=0.1, random_state=42)\n\nrf.fit(X_train, y_train)\ngbdt.fit(X_train, y_train)\n\nprint(f'RF AUC: {roc_auc_score(y_test, rf.predict_proba(X_test)[:,1]):.4f}')\nprint(f'GBDT AUC: {roc_auc_score(y_test, gbdt.predict_proba(X_test)[:,1]):.4f}')",
                    "difficulty_level": "intermediate",
                    "tags": ["随机森林", "GBDT", "客户流失", "类别不平衡"],
                    "source": "Kaggle竞赛案例",
                },
            ],
            "exercises": [
                {
                    "title": "Bagging与Boosting比较",
                    "exercise_type": "choice",
                    "difficulty_level": "intermediate",
                    "content": "以下关于Bagging和Boosting的描述，哪个是正确的？",
                    "options": ["Bagging的基学习器之间有强依赖关系", "Boosting通过并行训练基学习器提高效率", "Bagging主要降低方差，Boosting主要降低偏差", "Boosting对噪声数据比Bagging更鲁棒"],
                    "correct_answer": 2,
                    "answer_analysis": "Bagging通过引入随机性降低基学习器的相关性，主要减少方差（过拟合）；Boosting通过串行训练逐步修正错误，主要减少偏差（欠拟合）。A错误，Bagging的基学习器是独立的；B错误，Boosting是串行的；D错误，Boosting对噪声更敏感，因为会加大对噪声样本的关注。",
                    "knowledge_tags": ["Bagging", "Boosting", "偏差-方差"],
                    "score": 5,
                    "estimated_minutes": 4,
                },
            ],
        },
        {
            "title": "第7章 聚类",
            "order_index": 7,
            "teaching_hours": 4,
            "chapter_type": "theory",
            "description": "介绍无监督聚类的基本概念、K-Means算法、层次聚类和密度聚类方法。",
            "objectives": ["理解聚类问题的定义和性能度量", "掌握K-Means算法及其变体", "了解层次聚类和DBSCAN算法", "能够根据数据特点选择合适的聚类方法"],
            "key_points": ["K-Means", "距离度量", "DBSCAN", "轮廓系数"],
            "difficulties": ["K值选择", "不同聚类算法的适用场景", "高维数据的距离度量问题"],
            "teaching_methods": ["讲授", "可视化演示", "编程实验"],
            "knowledge_points": [
                {
                    "title": "K-Means算法",
                    "order_index": 1,
                    "difficulty_level": "beginner",
                    "importance": "core",
                    "definition": "K-Means是最经典的聚类算法，通过迭代优化将样本划分为K个簇，使每个样本到其所属簇中心的距离之和最小。",
                    "content": "**算法流程**\n1. 随机选择K个样本作为初始簇中心\n2. 将每个样本分配到最近的簇中心\n3. 重新计算每个簇的中心（均值）\n4. 重复2-3直到簇中心不再变化或达到最大迭代次数\n\n**优化目标**\nJ = ΣΣ||xᵢ-μₖ||²\n最小化所有样本到其簇中心的距离平方和\n\n**K值选择**\n- 肘部法则（Elbow Method）\n- 轮廓系数（Silhouette Score）\n- Gap Statistic\n\n**K-Means++**\n改进初始化策略，使初始簇中心尽可能分散",
                    "formulas": [
                        {"name": "K-Means目标函数", "formula": "J = ΣₖΣᵢ||xᵢ-μₖ||²", "description": "所有样本到其簇中心的距离平方和"},
                        {"name": "轮廓系数", "formula": "s(i) = (b(i)-a(i))/max{a(i),b(i)}", "description": "a(i)为簇内平均距离，b(i)为最近簇平均距离"},
                    ],
                    "tags": ["K-Means", "聚类", "无监督学习"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "DBSCAN密度聚类",
                    "order_index": 2,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "DBSCAN是基于密度的聚类算法，将簇定义为密度相连的样本最大集合，能够发现任意形状的簇并识别噪声点。",
                    "content": "**核心概念**\n- ε-邻域：样本x的ε半径内的区域\n- 核心对象：ε-邻域内至少包含MinPts个样本\n- 密度直达、密度可达、密度相连\n\n**算法流程**\n1. 找到所有核心对象\n2. 从任一核心对象出发，找到所有密度可达的样本\n3. 密度相连的最大样本集合构成一个簇\n4. 不属于任何簇的样本标记为噪声\n\n**优势**\n- 不需要预先指定簇数\n- 能发现任意形状的簇\n- 能识别噪声点\n\n**劣势**\n- 对ε和MinPts参数敏感\n- 对密度不均匀的数据效果差",
                    "tags": ["DBSCAN", "密度聚类", "噪声检测", "无监督学习"],
                    "source": "周志华《机器学习》",
                },
            ],
            "teaching_cases": [
                {
                    "title": "客户分群分析",
                    "case_type": "application",
                    "background": "电商平台需要根据用户的消费行为将客户分为不同群体，以便进行精准营销。",
                    "problem_description": "使用K-Means和DBSCAN对客户进行分群，比较两种方法的结果。",
                    "analysis": "1. 特征选择：消费频次、平均消费金额、最近消费时间（RFM模型）\n2. 特征标准化：消除量纲影响\n3. K-Means：使用肘部法则确定K值\n4. DBSCAN：调整ε和MinPts参数\n5. 轮廓系数评估聚类质量",
                    "solution": "先使用K-Means获得基线结果，再用DBSCAN检测异常客户和发现非球形群体。",
                    "conclusion": "K-Means适合发现大小相近的球形群体，DBSCAN能发现不规则形状的群体和异常值。实际应用中常结合两种方法获得更全面的客户画像。",
                    "code_example": "from sklearn.cluster import KMeans, DBSCAN\nfrom sklearn.metrics import silhouette_score\nfrom sklearn.preprocessing import StandardScaler\n\nscaler = StandardScaler()\nX_scaled = scaler.fit_transform(X_rfm)\n\nkmeans = KMeans(n_clusters=4, random_state=42)\nlabels_km = kmeans.fit_predict(X_scaled)\nprint(f'K-Means Silhouette: {silhouette_score(X_scaled, labels_km):.4f}')\n\ndbscan = DBSCAN(eps=0.5, min_samples=5)\nlabels_db = dbscan.fit_predict(X_scaled)\nn_clusters = len(set(labels_db)) - (1 if -1 in labels_db else 0)\nprint(f'DBSCAN clusters: {n_clusters}, noise: {sum(labels_db==-1)}')",
                    "difficulty_level": "intermediate",
                    "tags": ["聚类", "客户分群", "K-Means", "DBSCAN", "RFM"],
                    "source": "Scikit-learn文档",
                },
            ],
            "exercises": [
                {
                    "title": "K-Means性质",
                    "exercise_type": "choice",
                    "difficulty_level": "beginner",
                    "content": "关于K-Means算法，以下说法错误的是：",
                    "options": ["K-Means的聚类结果可能受初始中心点选择的影响", "K-Means只能发现球形簇", "K-Means每次迭代都保证目标函数值下降", "K-Means的时间复杂度为O(nKt)，其中n为样本数，K为簇数，t为迭代次数"],
                    "correct_answer": 2,
                    "answer_analysis": "K-Means的每次迭代保证目标函数值不增（单调不增），但不一定严格下降。当簇中心不再变化时，目标函数值保持不变。此外，K-Means只能收敛到局部最优，不保证全局最优。",
                    "knowledge_tags": ["K-Means", "聚类", "算法性质"],
                    "score": 5,
                    "estimated_minutes": 4,
                },
            ],
        },
        {
            "title": "第8章 降维与特征选择",
            "order_index": 8,
            "teaching_hours": 4,
            "chapter_type": "theory",
            "description": "介绍降维的动机、主成分分析（PCA）、线性判别分析（LDA）和特征选择方法。",
            "objectives": ["理解降维的动机和作用", "掌握PCA的原理和计算步骤", "了解LDA与PCA的区别", "掌握常见的特征选择方法"],
            "key_points": ["PCA", "LDA", "特征选择", "方差解释比"],
            "difficulties": ["PCA的数学推导", "核化降维", "特征选择与特征提取的区别"],
            "teaching_methods": ["讲授", "可视化", "编程实验"],
            "knowledge_points": [
                {
                    "title": "主成分分析（PCA）",
                    "order_index": 1,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "PCA是一种无监督的线性降维方法，通过正交变换将高维数据投影到方差最大的方向上，用较少的主成分保留原始数据的主要信息。",
                    "content": "**PCA算法步骤**\n1. 对数据进行中心化：x̃ᵢ = xᵢ - μ\n2. 计算协方差矩阵：C = (1/n)X̃ᵀX̃\n3. 对C进行特征值分解：C = VΛVᵀ\n4. 选择前d'个最大特征值对应的特征向量\n5. 将数据投影到选定的特征向量上：Z = X̃W\n\n**方差解释比**\nρₖ = λₖ/Σλⱼ\n选择累计方差解释比达到85%-95%的主成分数量\n\n**PCA的性质**\n- 最近重构性：最小化投影误差\n- 最大可分性：最大化投影后方差\n- 两种等价的目标导致相同的解",
                    "formulas": [
                        {"name": "协方差矩阵", "formula": "C = (1/n)X̃ᵀX̃", "description": "数据中心化后的协方差矩阵"},
                        {"name": "方差解释比", "formula": "ρₖ = λₖ/Σλⱼ", "description": "第k个主成分解释的方差比例"},
                    ],
                    "tags": ["PCA", "降维", "特征提取", "协方差矩阵"],
                    "source": "周志华《机器学习》",
                },
                {
                    "title": "特征选择方法",
                    "order_index": 2,
                    "difficulty_level": "intermediate",
                    "importance": "core",
                    "definition": "特征选择是从原始特征集中选择一个子集，使得模型性能最优的过程，与特征提取（如PCA）不同，特征选择不改变原始特征。",
                    "content": "**过滤式（Filter）**\n- 先进行特征选择，再训练模型\n- 方差阈值：去除方差过小的特征\n- 相关系数：去除高度相关的冗余特征\n- 互信息：衡量特征与目标的相关性\n- 卡方检验：类别型特征的选择\n\n**包裹式（Wrapper）**\n- 将特征选择与模型训练结合\n- 递归特征消除（RFE）\n- 前向/后向搜索\n- 计算开销大但效果通常更好\n\n**嵌入式（Embedded）**\n- 特征选择在模型训练过程中自动完成\n- L1正则化（Lasso）：产生稀疏解\n- 决策树：自动选择重要特征\n- 随机森林：特征重要性排序",
                    "tags": ["特征选择", "过滤式", "包裹式", "嵌入式"],
                    "source": "周志华《机器学习》",
                },
            ],
            "teaching_cases": [
                {
                    "title": "高维数据可视化",
                    "case_type": "demonstration",
                    "background": "在数据探索阶段，将高维数据降维到2D或3D进行可视化，有助于理解数据分布和发现模式。",
                    "problem_description": "使用PCA将64维的手写数字数据降维到2维，可视化不同数字的分布情况。",
                    "analysis": "1. 原始数据64维，无法直接可视化\n2. PCA保留方差最大的方向\n3. 2D投影可能损失信息，但能展示主要分布\n4. 不同数字在投影空间中应有一定分离",
                    "solution": "使用PCA将数据降维到2维，用不同颜色标记不同数字类别，绘制散点图。",
                    "conclusion": "PCA能有效将高维数据降维到可视化的维度。虽然2D投影损失了部分信息，但可以看出不同数字类别的大致分布趋势。对于更复杂的结构，t-SNE通常能产生更好的可视化效果。",
                    "code_example": "from sklearn.decomposition import PCA\nfrom sklearn.datasets import load_digits\nimport matplotlib.pyplot as plt\n\ndigits = load_digits()\npca = PCA(n_components=2)\nX_pca = pca.fit_transform(digits.data)\nprint(f'Explained variance ratio: {pca.explained_variance_ratio_}')\nprint(f'Total: {sum(pca.explained_variance_ratio_):.4f}')\n\nplt.scatter(X_pca[:,0], X_pca[:,1], c=digits.target, cmap='tab10', alpha=0.6, s=10)\nplt.colorbar(label='Digit')\nplt.xlabel('PC1'); plt.ylabel('PC2')\nplt.title('PCA of Digits Dataset')\nplt.savefig('digits_pca.png')",
                    "difficulty_level": "beginner",
                    "tags": ["PCA", "降维", "可视化", "手写数字"],
                    "source": "Scikit-learn文档",
                },
            ],
            "exercises": [
                {
                    "title": "PCA性质",
                    "exercise_type": "choice",
                    "difficulty_level": "intermediate",
                    "content": "关于PCA，以下说法正确的是：",
                    "options": ["PCA是一种有监督的降维方法", "PCA的主成分之间是正交的", "PCA的降维结果与数据标准化无关", "PCA总能保留原始数据的所有信息"],
                    "correct_answer": 1,
                    "answer_analysis": "PCA的主成分是协方差矩阵的特征向量，不同特征值对应的特征向量是正交的。A错误，PCA是无监督方法；C错误，PCA对数据的尺度敏感，需要先标准化；D错误，降维必然丢失信息。",
                    "knowledge_tags": ["PCA", "降维", "正交性"],
                    "score": 5,
                    "estimated_minutes": 3,
                },
                {
                    "title": "PCA计算",
                    "exercise_type": "calculation",
                    "difficulty_level": "advanced",
                    "content": "给定3个2维样本点：x₁=(1,1), x₂=(2,2), x₃=(3,3)，请计算第一主成分方向和方差解释比。",
                    "correct_answer": "中心化后：x̃₁=(-1,-1), x̃₂=(0,0), x̃₃=(1,1)\n协方差矩阵C = (1/3)[(-1,-1)ᵀ(-1,-1) + (0,0)ᵀ(0,0) + (1,1)ᵀ(1,1)]\n= (1/3)[[1,1],[1,1]] + [[0,0],[0,0]] + [[1,1],[1,1]]\n= [[2/3,2/3],[2/3,2/3]]\n\n特征值：det(C-λI)=0 → (2/3-λ)²-4/9=0 → λ₁=4/3, λ₂=0\n第一主成分方向：λ₁=4/3对应的特征向量(1/√2, 1/√2)\n方差解释比：4/3/(4/3+0) = 100%",
                    "answer_analysis": "这三个点完全在一条直线上(y=x)，所以第一主成分方向就是(1/√2,1/√2)，即45度方向，解释了100%的方差。第二主成分方向垂直于第一主成分，方差为0。",
                    "knowledge_tags": ["PCA", "特征值分解", "协方差矩阵"],
                    "score": 10,
                    "estimated_minutes": 12,
                },
            ],
        },
    ],
}


def seed_ml_course():
    with app.app_context():
        existing = Course.query.filter_by(title=ML_COURSE_DATA['course']['title']).first()
        if existing:
            print(f"[Seed] 课程'{ML_COURSE_DATA['course']['title']}'已存在 (ID={existing.id})，跳过创建")
            course_id = existing.id
        else:
            teacher = User.query.filter_by(role='teacher').first()
            if not teacher:
                teacher = User.query.filter_by(role='admin').first()
            if not teacher:
                print("[Seed] 错误：找不到教师用户，请先创建教师账户")
                return
            course_data = ML_COURSE_DATA['course']
            course = Course(
                title=course_data['title'],
                description=course_data['description'],
                teacher_id=teacher.id,
                category=course_data['category'],
                difficulty=course_data['difficulty'],
                duration=course_data['duration'],
                status=course_data['status'],
            )
            db.session.add(course)
            db.session.flush()
            course_id = course.id
            print(f"[Seed] 创建课程: {course_data['title']} (ID={course_id})")

        syllabus = CourseSyllabus.query.filter_by(course_id=course_id).first()
        if not syllabus:
            s_data = ML_COURSE_DATA['syllabus']
            syllabus = CourseSyllabus(
                course_id=course_id,
                course_code=s_data['course_code'],
                credit=s_data['credit'],
                total_hours=s_data['total_hours'],
                theory_hours=s_data['theory_hours'],
                practice_hours=s_data['practice_hours'],
                semester=s_data['semester'],
                prerequisite_courses=json.dumps(s_data['prerequisite_courses'], ensure_ascii=False),
                course_objectives=json.dumps(s_data['course_objectives'], ensure_ascii=False),
                assessment_methods=json.dumps(s_data['assessment_methods'], ensure_ascii=False),
                textbook=json.dumps(s_data['textbook'], ensure_ascii=False),
                references=json.dumps(s_data['references'], ensure_ascii=False),
                description=s_data['description'],
            )
            db.session.add(syllabus)
            print(f"[Seed] 创建课程大纲")
        else:
            print("[Seed] 课程大纲已存在，跳过")

        chapter_id_map = {}
        kp_id_map = {}
        total_kps = 0
        total_cases = 0
        total_exercises = 0

        for ch_data in ML_COURSE_DATA['chapters']:
            existing_ch = CourseChapter.query.filter_by(course_id=course_id, title=ch_data['title']).first()
            if existing_ch:
                chapter_id_map[ch_data['title']] = existing_ch.id
                print(f"[Seed] 章节已存在: {ch_data['title']}")
                continue

            chapter = CourseChapter(
                course_id=course_id,
                title=ch_data['title'],
                description=ch_data.get('description', ''),
                order_index=ch_data['order_index'],
                teaching_hours=ch_data.get('teaching_hours', 0),
                chapter_type=ch_data.get('chapter_type', 'theory'),
                objectives=json.dumps(ch_data.get('objectives', []), ensure_ascii=False),
                key_points=json.dumps(ch_data.get('key_points', []), ensure_ascii=False),
                difficulties=json.dumps(ch_data.get('difficulties', []), ensure_ascii=False),
                teaching_methods=json.dumps(ch_data.get('teaching_methods', []), ensure_ascii=False),
            )
            db.session.add(chapter)
            db.session.flush()
            chapter_id_map[ch_data['title']] = chapter.id
            print(f"[Seed] 创建章节: {ch_data['title']} (ID={chapter.id})")

            for kp_data in ch_data.get('knowledge_points', []):
                kp = KnowledgePoint(
                    course_id=course_id,
                    chapter_id=chapter.id,
                    title=kp_data['title'],
                    definition=kp_data.get('definition', ''),
                    content=kp_data.get('content', ''),
                    order_index=kp_data.get('order_index', 0),
                    difficulty_level=kp_data.get('difficulty_level', 'intermediate'),
                    importance=kp_data.get('importance', 'core'),
                    formulas=json.dumps(kp_data.get('formulas', []), ensure_ascii=False),
                    tags=json.dumps(kp_data.get('tags', []), ensure_ascii=False),
                    source=kp_data.get('source', ''),
                    source_url=kp_data.get('source_url', ''),
                )
                db.session.add(kp)
                db.session.flush()
                kp_id_map[f"{ch_data['title']}::{kp_data['title']}"] = kp.id
                total_kps += 1

            for case_data in ch_data.get('teaching_cases', []):
                case = TeachingCase(
                    course_id=course_id,
                    chapter_id=chapter.id,
                    title=case_data['title'],
                    case_type=case_data.get('case_type', 'application'),
                    background=case_data.get('background', ''),
                    problem_description=case_data.get('problem_description', ''),
                    analysis=case_data.get('analysis', ''),
                    solution=case_data.get('solution', ''),
                    conclusion=case_data.get('conclusion', ''),
                    code_example=case_data.get('code_example', ''),
                    difficulty_level=case_data.get('difficulty_level', 'intermediate'),
                    tags=json.dumps(case_data.get('tags', []), ensure_ascii=False),
                    source=case_data.get('source', ''),
                    source_url=case_data.get('source_url', ''),
                )
                db.session.add(case)
                total_cases += 1

            for ex_data in ch_data.get('exercises', []):
                correct_answer = ex_data['correct_answer']
                if not isinstance(correct_answer, str):
                    correct_answer = json.dumps(correct_answer, ensure_ascii=False)
                exercise = CourseExercise(
                    course_id=course_id,
                    chapter_id=chapter.id,
                    title=ex_data['title'],
                    exercise_type=ex_data.get('exercise_type', 'choice'),
                    difficulty_level=ex_data.get('difficulty_level', 'intermediate'),
                    content=ex_data['content'],
                    options=json.dumps(ex_data.get('options', []), ensure_ascii=False),
                    correct_answer=correct_answer,
                    answer_analysis=ex_data.get('answer_analysis', ''),
                    hints=json.dumps(ex_data.get('hints', []), ensure_ascii=False),
                    knowledge_tags=json.dumps(ex_data.get('knowledge_tags', []), ensure_ascii=False),
                    score=ex_data.get('score', 5.0),
                    estimated_minutes=ex_data.get('estimated_minutes', 5),
                    source=ex_data.get('source', ''),
                    source_url=ex_data.get('source_url', ''),
                )
                db.session.add(exercise)
                total_exercises += 1

        db.session.commit()

        print(f"\n[Seed] ========== 数据入库完成 ==========")
        print(f"[Seed] 课程: {ML_COURSE_DATA['course']['title']}")
        print(f"[Seed] 章节: {len(chapter_id_map)} 个")
        print(f"[Seed] 知识点: {total_kps} 个")
        print(f"[Seed] 教学案例: {total_cases} 个")
        print(f"[Seed] 习题: {total_exercises} 个")
        print(f"[Seed] ======================================")


if __name__ == '__main__':
    seed_ml_course()
