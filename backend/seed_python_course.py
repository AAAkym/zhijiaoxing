import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.user import db, User
from src.models.course import Course
from src.models.knowledge_base import CourseSyllabus, CourseChapter, KnowledgePoint, TeachingCase, CourseExercise
from src.main import app


PYTHON_COURSE_DATA = {
    "course": {
        "title": "Python程序设计",
        "description": "本课程系统讲授Python程序设计的基础知识与高级应用，涵盖开发环境搭建、基础语法、流程控制、数据结构、函数与模块化编程、面向对象编程、文件操作与异常处理、常用标准库与数据处理、网络编程与接口开发等核心内容。课程注重理论与实践结合，通过丰富的教学案例和编程练习，培养学生运用Python解决实际问题的能力，为后续数据科学、人工智能等方向的学习奠定坚实基础。",
        "category": "programming",
        "difficulty": "beginner",
        "duration": "64学时",
        "status": "active",
    },
    "syllabus": {
        "course_code": "CS1101",
        "credit": 4.0,
        "total_hours": 64,
        "theory_hours": 40,
        "practice_hours": 24,
        "semester": "秋季学期",
        "prerequisite_courses": ["计算机导论"],
        "course_objectives": [
            "掌握Python语言的基本语法、数据类型和运算符，能够编写规范的程序代码",
            "理解面向对象编程思想，能够运用类与对象、继承与多态设计程序结构",
            "熟练使用Python标准库，掌握文件操作、异常处理和常用数据处理方法",
            "能够运用Python进行数据采集、清洗和分析，处理常见的数据格式",
            "了解网络编程基础和接口开发框架，能够开发简单的网络应用程序",
            "具备良好的工程实践意识，掌握模块化设计、代码规范和项目组织方法",
        ],
        "assessment_methods": {
            "平时作业": 15,
            "实验报告": 25,
            "期中考试": 20,
            "期末考试": 40,
        },
        "textbook": {
            "title": "Python程序设计（第3版）",
            "author": "董付国",
            "publisher": "清华大学出版社",
            "year": 2021,
            "isbn": "978-7-302-58623-5",
        },
        "references": [
            {"title": "Python编程：从入门到实践（第3版）", "author": "Eric Matthes", "publisher": "人民邮电出版社", "year": 2023},
            {"title": "流畅的Python（第2版）", "author": "Luciano Ramalho", "publisher": "人民邮电出版社", "year": 2022},
            {"title": "Python核心编程（第3版）", "author": "Wesley Chun", "publisher": "人民邮电出版社", "year": 2018},
            {"title": "Python语言程序设计基础（第2版）", "author": "嵩天、礼欣、黄天羽", "publisher": "高等教育出版社", "year": 2017},
        ],
        "description": "Python程序设计是计算机科学与技术专业的入门课程，也是数据科学和人工智能方向的基础课程。本课程旨在培养学生系统掌握Python编程的基本理论、核心语法和实践技能，为后续数据结构、算法设计、数据挖掘等课程奠定基础。",
    },
    "chapters": [],
}


def _build_chapters():
    """构建8个章节的完整数据"""
    chapters = []

    # 第1章
    ch1 = {
        "title": "第1章 Python开发环境与基础语法",
        "order_index": 1,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "介绍Python开发环境的搭建与配置，讲解变量、数据类型、运算符和输入输出等基础语法知识，为后续学习奠定基础。",
        "objectives": ["能够独立搭建和配置Python开发环境", "掌握变量的定义和基本数据类型", "熟练使用各类运算符构建表达式", "掌握基本的输入输出操作"],
        "key_points": ["开发环境搭建", "变量与数据类型", "运算符与表达式", "输入输出操作"],
        "difficulties": ["数据类型的隐式转换规则", "运算符优先级与结合性"],
        "teaching_methods": ["讲授", "上机实践", "案例演示"],
        "knowledge_points": [
            {
                "title": "开发环境搭建",
                "order_index": 1,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "开发环境搭建是指安装和配置Python解释器、代码编辑器或集成开发环境（IDE），以及管理第三方包的过程，是编写和运行Python程序的基础。",
                "content": "Python开发环境的搭建是学习编程的第一步。Python解释器是执行Python代码的核心程序，目前主流版本为Python 3.x系列。安装Python后，系统会自动附带pip包管理工具，用于安装和管理第三方库。\n\n常用的集成开发环境包括：\n- IDLE：Python自带的轻量级开发环境，适合初学者\n- VS Code：微软开发的轻量级代码编辑器，通过安装Python扩展可提供强大的开发支持\n- PyCharm：JetBrains开发的专业Python IDE，功能丰富\n\n虚拟环境是Python项目开发的重要概念。通过venv或conda创建虚拟环境，可以隔离不同项目的依赖包，避免版本冲突。良好的开发习惯是为每个项目创建独立的虚拟环境。\n\n包管理方面，pip是Python的官方包管理工具，使用pip install命令可以安装第三方库，使用pip freeze命令可以导出项目依赖列表。",
                "examples": [{"title": "创建和激活虚拟环境", "code": "# 创建虚拟环境\npython -m venv myproject_env\n\n# 激活虚拟环境（Windows）\nmyproject_env\\Scripts\\activate\n\n# 激活虚拟环境（macOS/Linux）\nsource myproject_env/bin/activate\n\n# 安装第三方库\npip install requests\n\n# 导出依赖列表\npip freeze > requirements.txt"}],
                "tags": ["开发环境", "Python安装", "虚拟环境", "包管理"],
                "formulas": [],
                "prerequisites": [],
                "related_concepts": ["变量与数据类型", "模块与包"],
            },
            {
                "title": "变量与数据类型",
                "order_index": 2,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "变量是程序中用于存储数据的命名容器，数据类型则定义了数据的种类和可以执行的操作。Python是动态类型语言，变量不需要预先声明类型。",
                "content": "Python中的变量是对象的引用，赋值操作本质上是让变量名指向一个对象。Python是强类型语言，虽然不需要显式声明变量类型，但每个对象都有明确的类型。\n\n基本数据类型包括：\n- 整数（int）：如 10、-5、0，支持任意大小\n- 浮点数（float）：如 3.14、-0.5，遵循IEEE 754标准\n- 字符串（str）：如 '你好'、\"Python\"，使用引号界定\n- 布尔值（bool）：True或False，是int的子类\n- 空值（NoneType）：None，表示没有值\n\n类型转换分为隐式转换和显式转换。隐式转换由解释器自动完成，如int和float运算时int自动转为float。显式转换使用内置函数int()、float()、str()等。\n\n使用type()函数可以查看变量的类型，isinstance()函数可以判断对象是否为某个类型的实例。",
                "examples": [{"title": "基本数据类型与类型转换", "code": "# 变量赋值\nname = \"张三\"\nage = 20\nheight = 1.75\nis_student = True\n\n# 查看类型\nprint(type(name))       # <class 'str'>\nprint(type(age))        # <class 'int'>\nprint(type(height))     # <class 'float'>\n\n# 显式类型转换\nscore_str = \"95.5\"\nscore = float(score_str)\nprint(int(score))       # 95\nprint(str(age))         # '20'\n\n# 隐式类型转换\nresult = age + height   # int + float → float\nprint(type(result))     # <class 'float'>"}],
                "tags": ["变量", "数据类型", "类型转换", "整数", "浮点数", "字符串"],
                "formulas": [],
                "prerequisites": ["开发环境搭建"],
                "related_concepts": ["运算符与表达式", "输入输出操作"],
            },
            {
                "title": "运算符与表达式",
                "order_index": 3,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "运算符是执行特定运算操作的符号，表达式是由运算符和操作数组成的式子，运算结果是新值。Python支持算术、比较、逻辑、赋值等多种运算符。",
                "content": "Python的运算符按照功能可以分为以下几类：\n\n算术运算符：+（加）、-（减）、*（乘）、/（除）、//（整除）、%（取模）、**（幂运算）。其中整除运算符//返回商的整数部分，取模运算符%返回除法的余数。\n\n比较运算符：==、!=、>、<、>=、<=，返回布尔值。Python支持链式比较，如1 < x < 10等价于1 < x and x < 10。\n\n逻辑运算符：and、or、not，具有短路求值特性。and在第一个操作数为False时直接返回，or在第一个操作数为True时直接返回。\n\n赋值运算符：=、+=、-=、*=、/=等复合赋值运算符。Python还支持多重赋值和解包赋值。\n\n运算符优先级从高到低大致为：幂运算 > 正负号 > 乘除 > 加减 > 比较运算 > 逻辑运算。建议使用括号明确运算顺序，提高代码可读性。",
                "examples": [{"title": "运算符综合示例", "code": "# 算术运算\nprint(10 // 3)     # 3 整除\nprint(10 % 3)      # 1 取模\nprint(2 ** 10)     # 1024 幂运算\n\n# 链式比较\nx = 5\nprint(1 < x < 10)  # True\n\n# 逻辑运算的短路求值\ndef check():\n    print(\"函数被调用\")\n    return True\n\nFalse and check()   # 不会调用check()\nTrue or check()     # 不会调用check()\n\n# 多重赋值与解包\na, b, c = 1, 2, 3\nx, y = y, x        # 交换变量"}],
                "tags": ["运算符", "表达式", "算术运算", "逻辑运算", "优先级"],
                "formulas": [],
                "prerequisites": ["变量与数据类型"],
                "related_concepts": ["条件判断语句", "循环结构"],
            },
            {
                "title": "输入输出操作",
                "order_index": 4,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "输入输出操作是程序与用户交互的基本方式，input()函数用于接收用户输入，print()函数用于向控制台输出信息。格式化输出可以让数据以指定的形式展示。",
                "content": "input()函数从标准输入读取一行文本，返回字符串类型。如果需要数值类型，必须进行类型转换。input()可以接受一个字符串参数作为提示信息。\n\nprint()函数是最常用的输出方式，支持输出多个值，默认用空格分隔，末尾自动换行。可以通过sep和end参数自定义分隔符和结尾字符。\n\n格式化输出有三种方式：\n- f-string（推荐）：在字符串前加f，使用{}嵌入表达式，如f\"姓名：{name}，年龄：{age}\"\n- format()方法：使用{}占位符，通过位置或关键字传参\n- 百分号格式化：使用%s、%d、%f等占位符，类似C语言的printf\n\nf-string支持格式说明符，如:.2f保留两位小数、:>10右对齐占10位、:^居中对齐等，功能强大且语法简洁。",
                "examples": [{"title": "输入输出与格式化", "code": "# 输入操作\nname = input(\"请输入姓名：\")\nage = int(input(\"请输入年龄：\"))\n\n# f-string格式化（推荐）\nprint(f\"姓名：{name}，年龄：{age}\")\nprint(f\"圆周率：{3.14159:.2f}\")   # 3.14\nprint(f\"{'成绩':>8}：{95.5:>8.1f}\")\n\n# format()方法\nprint(\"姓名：{}，年龄：{}\".format(name, age))\n\n# 百分号格式化\nprint(\"姓名：%s，年龄：%d\" % (name, age))"}],
                "tags": ["输入输出", "格式化", "f-string", "print", "input"],
                "formulas": [],
                "prerequisites": ["变量与数据类型"],
                "related_concepts": ["文件读写操作"],
            },
        ],
        "teaching_cases": [
            {
                "title": "个人信息卡片生成器",
                "case_type": "application",
                "background": "在许多应用场景中，需要根据用户输入的个人信息生成格式化的信息卡片，如学生证、员工工牌等。这是一个综合运用变量、数据类型、输入输出和格式化技术的典型案例。",
                "problem_description": "编写一个程序，接收用户输入的姓名、年龄、班级和爱好，生成一张格式美观的个人信息卡片并输出。",
                "analysis": "1. 使用input()函数接收用户输入的各项信息\n2. 对年龄进行类型转换，确保为整数\n3. 使用f-string进行格式化输出，设计卡片的边框和对齐方式\n4. 综合运用字符串操作和格式化技术美化输出效果",
                "solution": "通过input获取用户输入，使用f-string的格式化功能（居中、对齐、填充字符等）生成美观的卡片输出，展示Python格式化输出的强大能力。",
                "conclusion": "通过个人信息卡片生成器的实现，综合运用了变量定义、类型转换、输入输出和字符串格式化等基础知识。f-string的格式化功能非常强大，能够满足各种输出排版需求。",
                "code_example": "# 个人信息卡片生成器\nname = input(\"请输入姓名：\")\nage = int(input(\"请输入年龄：\"))\nclass_name = input(\"请输入班级：\")\nhobby = input(\"请输入爱好：\")\n\nwidth = 30\nborder = \"=\" * width\n\nprint(border)\nprint(f\"|{'个人信息卡片':^{width-2}}|\")\nprint(border)\nprint(f\"|{'姓名：' + name:<{width-6}}|\")\nprint(f\"|{'年龄：' + str(age):<{width-6}}|\")\nprint(f\"|{'班级：' + class_name:<{width-6}}|\")\nprint(f\"|{'爱好：' + hobby:<{width-6}}|\")\nprint(border)",
                "difficulty_level": "beginner",
                "tags": ["输入输出", "格式化", "f-string", "综合应用"],
            },
        ],
        "exercises": [
            {
                "title": "数据类型判断",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下关于Python数据类型的描述，哪个是正确的？",
                "options": ["Python中变量必须先声明类型再使用", "Python中整数和浮点数相加，结果为整数", "Python中布尔值True实际上是整数1的子类", "Python中字符串和整数可以直接相加"],
                "correct_answer": 2,
                "answer_analysis": "Python中bool是int的子类，True等于1，False等于0。选项A错误，Python是动态类型语言，不需要预先声明类型；选项B错误，整数和浮点数相加结果为浮点数；选项D错误，字符串和整数不能直接相加，需要类型转换。",
                "hints": ["思考bool类型的继承关系", "可以在交互环境中验证True + 1的结果"],
                "knowledge_tags": ["数据类型", "布尔值", "类型系统"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "运算符优先级",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "表达式 2 + 3 * 4 ** 2 的计算结果是？",
                "options": ["56", "128", "50", "80"],
                "correct_answer": 2,
                "answer_analysis": "按照优先级从高到低计算：4**2=16，3*16=48，2+48=50。幂运算优先级最高，然后是乘法，最后是加法。",
                "hints": ["幂运算优先级最高", "乘法优先级高于加法"],
                "knowledge_tags": ["运算符", "优先级", "表达式求值"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "格式化输出",
                "exercise_type": "short_answer",
                "difficulty_level": "beginner",
                "content": "请使用f-string编写一行代码，将变量pi=3.14159265输出为保留3位小数、总宽度为8、右对齐的格式。",
                "correct_answer": "print(f\"{pi:>8.3f}\")  # 输出：   3.142",
                "answer_analysis": "f-string格式说明符中，>表示右对齐，8表示总宽度，.3f表示保留3位小数的浮点格式。输出结果为3个空格加3.142，共8个字符。",
                "hints": ["f-string格式为{变量:格式说明符}", "右对齐用>，宽度在前，精度在后"],
                "knowledge_tags": ["格式化输出", "f-string", "格式说明符"],
                "score": 10.0,
                "estimated_minutes": 8,
            },
        ],
    }
    chapters.append(ch1)

    # 第2章
    ch2 = {
        "title": "第2章 流程控制与程序结构",
        "order_index": 2,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "讲解条件判断、循环结构和流程控制语句，使学生掌握程序的三种基本结构：顺序、选择和循环。",
        "objectives": ["掌握if-elif-else条件判断语句", "熟练使用for和while循环结构", "理解break、continue等循环控制语句", "能够综合运用流程控制解决实际问题"],
        "key_points": ["条件判断语句", "循环结构", "循环控制与嵌套", "综合应用"],
        "difficulties": ["嵌套循环的执行流程", "循环与条件的组合逻辑"],
        "teaching_methods": ["讲授", "流程图演示", "上机实践"],
        "knowledge_points": [
            {
                "title": "条件判断语句",
                "order_index": 1,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "条件判断语句根据条件的真假选择不同的执行路径，是程序实现分支逻辑的基本结构。Python使用if-elif-else语句实现条件判断。",
                "content": "if语句是最基本的条件判断结构，语法为：if 条件: 执行体。条件表达式的值为True时执行缩进的代码块。\n\nif-else语句提供两个分支，条件为True执行if分支，否则执行else分支。\n\nif-elif-else语句支持多条件判断，从上到下依次检查条件，第一个为True的分支被执行，其余分支被跳过。elif可以有多个，else可以省略。\n\n条件表达式（三元运算符）：值1 if 条件 else 值2，用于简洁的条件赋值。\n\nPython使用缩进（4个空格）表示代码块的层级关系，而不是花括号。缩进是语法的一部分，缩进错误会导致IndentationError或逻辑错误。",
                "examples": [{"title": "多条件判断与三元运算", "code": "# 成绩等级判断\nscore = 85\nif score >= 90:\n    grade = '优秀'\nelif score >= 80:\n    grade = '良好'\nelif score >= 70:\n    grade = '中等'\nelif score >= 60:\n    grade = '及格'\nelse:\n    grade = '不及格'\nprint(f\"成绩等级：{grade}\")  # 良好\n\n# 三元运算符\nstatus = \"成年\" if age >= 18 else \"未成年\""}],
                "tags": ["条件判断", "if语句", "分支结构", "三元运算"],
                "formulas": [],
                "prerequisites": ["变量与数据类型", "运算符与表达式"],
                "related_concepts": ["循环结构", "布尔值"],
            },
            {
                "title": "循环结构",
                "order_index": 2,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "循环结构用于重复执行一段代码，Python提供for循环和while循环两种形式。for循环用于遍历序列，while循环用于条件控制的重复执行。",
                "content": "for循环是Python中最常用的循环结构，基本语法为：for 变量 in 可迭代对象: 循环体。常与range()函数配合使用，range(start, stop, step)生成整数序列。\n\nwhile循环在条件为True时反复执行循环体，语法为：while 条件: 循环体。需要在循环体中修改条件相关的变量，否则可能导致无限循环。\n\nfor循环适合已知循环次数的场景，while循环适合不确定循环次数但知道终止条件的场景。\n\nenumerate()函数可以在遍历时同时获取索引和值，zip()函数可以同时遍历多个序列。\n\n循环的else子句：当循环正常结束（未被break中断）时执行else块。这一特性在查找操作中特别有用。",
                "examples": [{"title": "for循环与while循环", "code": "# for循环遍历\nfruits = ['苹果', '香蕉', '橙子']\nfor fruit in fruits:\n    print(fruit)\n\n# range函数\nfor i in range(1, 10, 2):\n    print(i)  # 1 3 5 7 9\n\n# enumerate同时获取索引和值\nfor idx, fruit in enumerate(fruits):\n    print(f\"第{idx+1}个水果：{fruit}\")\n\n# while循环\ncount = 0\nwhile count < 5:\n    print(f\"计数：{count}\")\n    count += 1\n\n# 循环else子句\nfor n in range(2, 10):\n    for x in range(2, n):\n        if n % x == 0:\n            break\n    else:\n        print(f\"{n}是素数\")"}],
                "tags": ["循环", "for循环", "while循环", "range", "遍历"],
                "formulas": [],
                "prerequisites": ["条件判断语句"],
                "related_concepts": ["循环控制与嵌套", "列表"],
            },
            {
                "title": "循环控制与嵌套",
                "order_index": 3,
                "difficulty_level": "intermediate",
                "importance": "core",
                "definition": "循环控制语句用于改变循环的正常执行流程，break用于立即退出循环，continue用于跳过当前迭代。嵌套循环是指循环体内包含另一个循环的结构。",
                "content": "break语句用于立即终止当前循环，跳出循环体执行循环后面的代码。在嵌套循环中，break只跳出最内层的循环。\n\ncontinue语句用于跳过当前迭代的剩余代码，直接进入下一次迭代。与break不同，continue不会终止整个循环。\n\npass语句是空操作占位符，当语法上需要语句但逻辑上不需要操作时使用，常用于定义空函数或空类。\n\n嵌套循环将一个循环放在另一个循环内部。外层循环每执行一次，内层循环完整执行一遍。嵌套循环的总执行次数等于各层循环次数的乘积。\n\n嵌套循环的常见应用：打印图形、遍历二维数据、排列组合等。使用嵌套循环时要注意性能问题，层数过多会导致执行时间急剧增长。",
                "examples": [{"title": "循环控制与嵌套示例", "code": "# break示例：查找第一个能被7整除的数\nfor i in range(1, 100):\n    if i % 7 == 0:\n        print(f\"找到：{i}\")\n        break\n\n# continue示例：跳过偶数\nfor i in range(10):\n    if i % 2 == 0:\n        continue\n    print(i)  # 只打印奇数\n\n# 嵌套循环：九九乘法表\nfor i in range(1, 10):\n    for j in range(1, i + 1):\n        print(f\"{j}×{i}={i*j}\", end=\"\\t\")\n    print()"}],
                "tags": ["break", "continue", "嵌套循环", "循环控制"],
                "formulas": [],
                "prerequisites": ["循环结构"],
                "related_concepts": ["综合应用", "列表"],
            },
            {
                "title": "综合应用",
                "order_index": 4,
                "difficulty_level": "intermediate",
                "importance": "supplementary",
                "definition": "综合应用是将条件判断和循环结构结合使用，解决实际问题的编程能力。通过合理组织程序结构，实现复杂的业务逻辑。",
                "content": "在实际编程中，条件判断和循环结构往往需要组合使用。常见的综合应用模式包括：\n\n累加与累乘：使用循环计算数值序列的和或积，配合条件判断进行筛选。\n\n查找与搜索：在数据序列中查找满足条件的元素，找到后使用break退出循环，利用循环的else子句处理未找到的情况。\n\n数据统计：对一组数据进行分类统计，如统计正数、负数和零的个数。\n\n图形打印：利用嵌套循环和条件判断，打印各种规则的字符图形。\n\n数值计算：使用循环实现迭代算法，如求最大公约数、判断素数、计算阶乘等。",
                "examples": [{"title": "综合应用示例", "code": "# 判断素数\ndef is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\n\n# 辗转相除法求最大公约数\ndef gcd(a, b):\n    while b:\n        a, b = b, a % b\n    return a\n\n# 打印菱形\nn = 5\nfor i in range(n):\n    print(' ' * (n - i - 1) + '*' * (2 * i + 1))\nfor i in range(n - 2, -1, -1):\n    print(' ' * (n - i - 1) + '*' * (2 * i + 1))"}],
                "tags": ["综合应用", "算法", "素数判断", "数值计算"],
                "formulas": [],
                "prerequisites": ["条件判断语句", "循环结构", "循环控制与嵌套"],
                "related_concepts": ["函数定义与调用"],
            },
        ],
        "teaching_cases": [
            {
                "title": "智能猜数字游戏",
                "case_type": "application",
                "background": "猜数字游戏是经典的编程练习项目，程序随机生成一个数字，玩家通过输入猜测的数字，程序给出大了或小了的提示，直到猜中为止。",
                "problem_description": "编写一个猜数字游戏程序，随机生成1到100之间的整数，允许玩家最多猜测7次，每次猜测后给出提示（偏大、偏小或猜中），并在游戏结束后显示答案和猜测次数。",
                "analysis": "1. 使用random模块生成随机数\n2. 使用while循环控制猜测次数，最多7次\n3. 每次猜测后用if-elif判断偏大、偏小或猜中\n4. 猜中后使用break退出循环\n5. 循环结束后判断是否猜中，给出相应提示",
                "solution": "使用random.randint()生成随机数，while循环控制猜测过程，if-elif-else判断猜测结果，break在猜中时退出循环，循环的else子句处理未猜中的情况。",
                "conclusion": "猜数字游戏综合运用了随机数、循环、条件判断和循环控制等核心知识。通过这个案例，可以深入理解while循环与break配合使用的模式，以及循环else子句的实际应用场景。",
                "code_example": "import random\n\ntarget = random.randint(1, 100)\nmax_attempts = 7\nprint(f\"我想了一个1到100之间的数字，你有{max_attempts}次机会猜中它！\")\n\nattempt = 0\nwhile attempt < max_attempts:\n    attempt += 1\n    guess = int(input(f\"第{attempt}次猜测，请输入：\"))\n    if guess > target:\n        print(\"偏大了！\")\n    elif guess < target:\n        print(\"偏小了！\")\n    else:\n        print(f\"恭喜你猜中了！答案就是{target}，你用了{attempt}次。\")\n        break\nelse:\n    print(f\"很遗憾，{max_attempts}次机会用完了。答案是{target}。\")",
                "difficulty_level": "beginner",
                "tags": ["猜数字", "随机数", "循环", "条件判断", "游戏"],
            },
        ],
        "exercises": [
            {
                "title": "循环结构选择",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下关于Python循环的描述，哪个是正确的？",
                "options": ["for循环只能遍历列表", "while循环的else子句在条件为False时执行", "break语句可以跳出所有嵌套循环", "continue语句会终止整个循环"],
                "correct_answer": 1,
                "answer_analysis": "while循环的else子句在循环条件变为False时执行（即循环正常结束时），如果循环被break中断则不执行else块。选项A错误，for循环可以遍历任何可迭代对象；选项C错误，break只跳出最内层循环；选项D错误，continue只跳过当前迭代，不终止整个循环。",
                "hints": ["回忆循环else子句的执行条件", "break只影响最内层循环"],
                "knowledge_tags": ["循环", "break", "continue", "else子句"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "循环执行次数",
                "exercise_type": "choice",
                "difficulty_level": "intermediate",
                "content": "以下代码的输出结果是什么？\nfor i in range(1, 10):\n    if i % 3 == 0:\n        continue\n    if i > 7:\n        break\n    print(i, end=' ')",
                "options": ["1 2 4 5 7", "1 2 4 5 7 8", "1 2 4 5", "1 2 4 5 7 8 9"],
                "correct_answer": 0,
                "answer_analysis": "遍历1到9：i=1输出1，i=2输出2，i=3被continue跳过，i=4输出4，i=5输出5，i=6被continue跳过，i=7输出7，i=8大于7被break终止循环。所以输出1 2 4 5 7。",
                "hints": ["逐个分析i的取值", "注意continue和break的区别"],
                "knowledge_tags": ["循环", "continue", "break", "执行流程"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "嵌套循环编程",
                "exercise_type": "short_answer",
                "difficulty_level": "intermediate",
                "content": "请编写程序，使用嵌套循环找出100以内的所有素数并输出。",
                "correct_answer": "for num in range(2, 101):\n    is_prime = True\n    for i in range(2, int(num**0.5) + 1):\n        if num % i == 0:\n            is_prime = False\n            break\n    if is_prime:\n        print(num, end=' ')",
                "answer_analysis": "外层循环遍历2到100的每个数，内层循环检查该数是否能被2到其平方根之间的数整除。如果都不能整除，则为素数。优化点：内层循环只需检查到平方根即可。",
                "hints": ["素数是只能被1和自身整除的大于1的整数", "判断素数时只需检查到平方根即可"],
                "knowledge_tags": ["嵌套循环", "素数", "算法", "break"],
                "score": 10.0,
                "estimated_minutes": 8,
            },
        ],
    }
    chapters.append(ch2)

    # 第3章
    ch3 = {
        "title": "第3章 数据结构基础",
        "order_index": 3,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "介绍Python内置的核心数据结构：列表、元组、集合和字典，掌握它们的创建、操作和应用场景。",
        "objectives": ["掌握列表的创建和常用操作方法", "理解元组与集合的特点和使用场景", "熟练使用字典进行键值对数据管理", "能够根据实际问题选择合适的数据结构"],
        "key_points": ["列表", "元组与集合", "字典", "数据结构综合应用"],
        "difficulties": ["可变与不可变类型的区别", "字典的底层实现原理", "深拷贝与浅拷贝"],
        "teaching_methods": ["讲授", "对比分析", "上机实践"],
        "knowledge_points": [
            {
                "title": "列表",
                "order_index": 1,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "列表是Python中最常用的有序可变序列，可以存储任意类型的元素，支持索引访问、切片、添加、删除和排序等丰富操作。",
                "content": "列表使用方括号[]创建，元素之间用逗号分隔。列表是可变的，可以动态添加、删除和修改元素。\n\n索引与切片：正向索引从0开始，反向索引从-1开始。切片语法为list[start:stop:step]，可以获取子列表。\n\n常用操作方法：\n- 添加元素：append()末尾添加、insert()指定位置插入、extend()合并列表\n- 删除元素：remove()按值删除、pop()按索引删除、clear()清空列表\n- 查找与统计：index()查找索引、count()统计次数、in判断存在\n- 排序与反转：sort()原地排序、sorted()返回新列表、reverse()反转\n\n列表推导式是Python的特色语法，可以用简洁的表达式创建列表：[表达式 for 变量 in 可迭代对象 if 条件]。\n\n列表的拷贝：直接赋值是引用，浅拷贝用copy()或切片[:]，深拷贝用copy.deepcopy()。",
                "examples": [{"title": "列表操作与推导式", "code": "fruits = ['苹果', '香蕉', '橙子']\nfruits.append('葡萄')\nfruits.insert(1, '西瓜')\nfruits.remove('香蕉')\nlast = fruits.pop()\n\nnums = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]\nprint(nums[2:7:2])   # [2, 4, 6]\nprint(nums[::-1])    # 反转列表\n\nsquares = [x**2 for x in range(10)]\neven_squares = [x**2 for x in range(10) if x % 2 == 0]"}],
                "tags": ["列表", "索引", "切片", "列表推导式", "可变序列"],
                "formulas": [],
                "prerequisites": ["循环结构"],
                "related_concepts": ["元组与集合", "字典"],
            },
            {
                "title": "元组与集合",
                "order_index": 2,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "元组是不可变的有序序列，一旦创建不能修改，常用于存储固定不变的数据。集合是无序的不重复元素集，支持数学集合运算，常用于去重和成员检测。",
                "content": "元组使用圆括号()创建，元素不可修改。元组支持索引和切片，但不支持添加、删除和修改操作。单元素元组必须加逗号，如(1,)。元组可以作为字典的键，也可以在函数中返回多个值。\n\n集合使用花括号{}或set()创建，元素自动去重且无序。空集合只能用set()创建，{}创建的是空字典。\n\n集合运算：\n- 交集：a & b 或 a.intersection(b)\n- 并集：a | b 或 a.union(b)\n- 差集：a - b 或 a.difference(b)\n- 对称差集：a ^ b 或 a.symmetric_difference(b)\n\n集合推导式：{表达式 for 变量 in 可迭代对象 if 条件}\n\nfrozenset是不可变集合，创建后不能修改，可以作为字典的键。",
                "examples": [{"title": "元组与集合操作", "code": "point = (3, 4)\nx, y = point  # 解包\n\ndef min_max(lst):\n    return min(lst), max(lst)\n\nnums = [1, 2, 2, 3, 3, 3, 4]\nunique = set(nums)  # {1, 2, 3, 4}\n\na = {1, 2, 3, 4}\nb = {3, 4, 5, 6}\nprint(a & b)  # {3, 4} 交集\nprint(a | b)  # {1, 2, 3, 4, 5, 6} 并集\nprint(a - b)  # {1, 2} 差集"}],
                "tags": ["元组", "集合", "不可变", "去重", "集合运算"],
                "formulas": [],
                "prerequisites": ["列表"],
                "related_concepts": ["字典", "数据结构综合应用"],
            },
            {
                "title": "字典",
                "order_index": 3,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "字典是键值对的无序可变集合，通过键快速查找对应的值。字典是Python中最重要的映射类型，查找效率极高。",
                "content": "字典使用花括号{}或dict()创建，每个元素是键:值对。键必须是不可变类型（字符串、数字、元组），值可以是任意类型。\n\n基本操作：\n- 访问：d[key]或d.get(key, default)\n- 添加/修改：d[key] = value\n- 删除：del d[key]、d.pop(key)、d.popitem()\n- 遍历：d.items()遍历键值对、d.keys()遍历键、d.values()遍历值\n\n字典推导式：{k: v for k, v in 可迭代对象 if 条件}\n\n常用方法：setdefault()、update()、fromkeys()\n\nPython 3.7+保证字典的插入顺序。",
                "examples": [{"title": "字典操作与推导式", "code": "student = {'姓名': '张三', '年龄': 20, '专业': '计算机'}\nprint(student['姓名'])\nprint(student.get('成绩', '未录入'))\n\nstudent['成绩'] = 95  # 添加\nstudent['年龄'] = 21  # 修改\n\nfor key, value in student.items():\n    print(f\"{key}: {value}\")\n\nwords = ['apple', 'banana', 'cherry']\nword_lengths = {w: len(w) for w in words}\nprint(word_lengths)"}],
                "tags": ["字典", "键值对", "映射", "字典推导式"],
                "formulas": [],
                "prerequisites": ["列表", "元组与集合"],
                "related_concepts": ["数据结构综合应用", "JSON"],
            },
            {
                "title": "数据结构综合应用",
                "order_index": 4,
                "difficulty_level": "intermediate",
                "importance": "supplementary",
                "definition": "数据结构综合应用是指根据实际问题的需求，合理选择和组合列表、元组、集合、字典等数据结构，高效地组织和处理数据。",
                "content": "在实际编程中，往往需要组合使用多种数据结构来解决复杂问题。常见组合模式：\n\n列表+字典：列表存储多个字典，每个字典代表一条记录。\n\n字典+列表：字典的值为列表，用于分组存储数据。\n\n集合+字典：集合用于快速判断成员关系，字典用于存储详细信息。\n\n数据统计与分析：使用字典进行频次统计，使用列表排序获取排名，使用集合去重获取唯一值。",
                "examples": [{"title": "综合数据结构应用", "code": "students = [\n    {'姓名': '张三', '班级': 'A班', '成绩': 92},\n    {'姓名': '李四', '班级': 'B班', '成绩': 85},\n    {'姓名': '王五', '班级': 'A班', '成绩': 78},\n    {'姓名': '赵六', '班级': 'B班', '成绩': 95},\n]\n\nclass_groups = {}\nfor s in students:\n    cls = s['班级']\n    class_groups.setdefault(cls, []).append(s['姓名'])\n\nranked = sorted(students, key=lambda x: x['成绩'], reverse=True)\nfor i, s in enumerate(ranked, 1):\n    print(f\"第{i}名：{s['姓名']} - {s['成绩']}分\")"}],
                "tags": ["数据结构", "综合应用", "分组", "排序", "统计"],
                "formulas": [],
                "prerequisites": ["列表", "元组与集合", "字典"],
                "related_concepts": ["函数定义与调用"],
            },
        ],
        "teaching_cases": [
            {
                "title": "学生成绩管理系统",
                "case_type": "application",
                "background": "学生成绩管理是教学管理中的基本需求，需要实现成绩的录入、查询、统计和排名等功能。",
                "problem_description": "编写一个学生成绩管理程序，支持添加学生成绩、按姓名查询、统计班级平均分、按成绩排名等功能。",
                "analysis": "1. 使用列表存储所有学生记录，每条记录为字典\n2. 使用字典实现按姓名快速查询\n3. 使用列表排序实现成绩排名\n4. 使用字典分组实现班级统计",
                "solution": "设计数据结构：列表存储学生字典，字典建立姓名到学生记录的映射。实现添加、查询、统计、排名等核心功能。",
                "conclusion": "学生成绩管理系统展示了列表和字典的组合使用。列表适合有序遍历和排序，字典适合快速查找。合理选择数据结构可以显著提高程序的效率。",
                "code_example": "students = []\nname_index = {}\n\ndef add_student(name, cls, score):\n    student = {'姓名': name, '班级': cls, '成绩': score}\n    students.append(student)\n    name_index[name] = len(students) - 1\n\ndef query_student(name):\n    if name in name_index:\n        s = students[name_index[name]]\n        print(f\"姓名：{s['姓名']}，班级：{s['班级']}，成绩：{s['成绩']}\")\n\ndef class_average(cls):\n    cls_scores = [s['成绩'] for s in students if s['班级'] == cls]\n    if cls_scores:\n        print(f\"{cls}平均分：{sum(cls_scores)/len(cls_scores):.1f}\")\n\ndef rank_students():\n    ranked = sorted(students, key=lambda x: x['成绩'], reverse=True)\n    for i, s in enumerate(ranked, 1):\n        print(f\"第{i}名：{s['姓名']} - {s['成绩']}分\")\n\nadd_student('张三', 'A班', 92)\nadd_student('李四', 'B班', 85)\nadd_student('王五', 'A班', 78)\nrank_students()",
                "difficulty_level": "intermediate",
                "tags": ["成绩管理", "字典", "列表", "排序", "综合应用"],
            },
        ],
        "exercises": [
            {
                "title": "列表操作",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "执行以下代码后，列表nums的内容是什么？\nnums = [1, 2, 3, 4, 5]\nnums.append(6)\nnums.insert(0, 0)\nnums.pop(3)\nnums.reverse()",
                "options": ["[6, 5, 4, 2, 1, 0]", "[6, 5, 3, 2, 1, 0]", "[0, 1, 3, 4, 5, 6]", "[6, 5, 4, 3, 2, 1, 0]"],
                "correct_answer": 0,
                "answer_analysis": "逐步分析：初始[1,2,3,4,5]，append(6)后[1,2,3,4,5,6]，insert(0,0)后[0,1,2,3,4,5,6]，pop(3)删除索引3的元素3得到[0,1,2,4,5,6]，reverse()反转得到[6,5,4,2,1,0]。",
                "hints": ["逐步跟踪列表的变化", "pop(3)删除的是索引3的元素"],
                "knowledge_tags": ["列表", "append", "insert", "pop", "reverse"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "字典操作",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下关于Python字典的描述，哪个是错误的？",
                "options": ["字典的键必须是不可变类型", "字典的值可以是任意类型", "同一个字典中可以有两个相同的键", "使用get()方法访问不存在的键不会报错"],
                "correct_answer": 2,
                "answer_analysis": "字典的键必须唯一，如果对已有键再次赋值，会覆盖原来的值，而不是创建两个相同的键。",
                "hints": ["字典的键有什么唯一性要求？", "尝试创建两个相同键的字典看看结果"],
                "knowledge_tags": ["字典", "键", "不可变类型"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "列表推导式编程",
                "exercise_type": "short_answer",
                "difficulty_level": "intermediate",
                "content": "请使用列表推导式生成一个包含1到100之间所有能被3整除但不能被5整除的数的列表。",
                "correct_answer": "result = [x for x in range(1, 101) if x % 3 == 0 and x % 5 != 0]",
                "answer_analysis": "列表推导式的基本结构为[表达式 for 变量 in 可迭代对象 if 条件]。这里表达式就是x本身，可迭代对象是range(1,101)，条件是x能被3整除且不能被5整除。",
                "hints": ["列表推导式的语法结构", "使用and连接两个条件"],
                "knowledge_tags": ["列表推导式", "条件筛选", "整除判断"],
                "score": 10.0,
                "estimated_minutes": 8,
            },
        ],
    }
    chapters.append(ch3)

    # 第4章
    ch4 = {
        "title": "第4章 函数与模块化编程",
        "order_index": 4,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "讲解函数的定义与调用、参数传递、作用域规则和模块化编程思想，培养学生组织代码和复用代码的能力。",
        "objectives": ["掌握函数的定义和调用方法", "理解参数传递机制和返回值的使用", "掌握作用域规则和闭包的概念", "能够使用模块和包组织代码"],
        "key_points": ["函数定义与调用", "参数传递与返回值", "作用域与闭包", "模块与包"],
        "difficulties": ["闭包的理解", "可变默认参数的陷阱", "装饰器原理"],
        "teaching_methods": ["讲授", "代码演示", "上机实践"],
        "knowledge_points": [
            {
                "title": "函数定义与调用",
                "order_index": 1, "difficulty_level": "beginner", "importance": "core",
                "definition": "函数是将一段具有特定功能的代码封装起来的程序单元，通过函数名进行调用，可以接收参数并返回结果。函数是代码复用和模块化设计的基础。",
                "content": "Python使用def关键字定义函数，语法为：def 函数名(参数列表): 函数体。函数体使用缩进表示，通常以return语句返回结果。\n\n函数的文档字符串（docstring）使用三引号写在函数体第一行，用于说明函数的功能、参数和返回值。\n\n函数是一等公民，可以赋值给变量、作为参数传递、作为返回值返回。\n\nlambda表达式用于创建匿名函数，语法为：lambda 参数: 表达式。\n\n递归函数是直接或间接调用自身的函数，必须有终止条件，否则会导致栈溢出。",
                "examples": [{"title": "函数定义与递归", "code": "def greet(name, greeting='你好'):\n    return f\"{greeting}，{name}！\"\n\nprint(greet('张三'))\nprint(greet('李四', '早上好'))\n\ndef factorial(n):\n    if n <= 1:\n        return 1\n    return n * factorial(n - 1)\n\nprint(factorial(5))  # 120\n\nsquare = lambda x: x ** 2\nprint(square(5))     # 25"}],
                "tags": ["函数", "定义", "调用", "递归", "lambda"],
                "formulas": [], "prerequisites": ["变量与数据类型", "循环结构"], "related_concepts": ["参数传递与返回值", "作用域与闭包"],
            },
            {
                "title": "参数传递与返回值",
                "order_index": 2, "difficulty_level": "intermediate", "importance": "core",
                "definition": "参数传递是调用函数时将数据传入函数内部的机制，返回值是函数执行完毕后向调用者传递结果的机制。Python的参数传递采用对象引用传递方式。",
                "content": "Python函数的参数类型丰富：\n\n位置参数：按顺序传递，调用时必须提供。\n关键字参数：通过参数名指定，可以不按顺序传递。\n默认参数：定义时指定默认值，调用时可省略。注意：默认参数不要使用可变对象。\n\n可变参数：\n- *args：接收任意数量的位置参数，以元组形式收集\n- **kwargs：接收任意数量的关键字参数，以字典形式收集\n\n返回值：return语句返回结果并结束函数执行，可以返回多个值（实际返回元组），没有return则返回None。\n\nPython的参数传递是对象引用传递。对于不可变对象，函数内的修改不影响外部；对于可变对象，函数内的修改会影响外部。",
                "examples": [{"title": "参数类型与传递", "code": "def calculate(*args, **kwargs):\n    print(f\"位置参数：{args}\")\n    print(f\"关键字参数：{kwargs}\")\n\ncalculate(1, 2, 3, name='张三', age=20)\n\ndef divide(a, b):\n    return a // b, a % b\n\nq, r = divide(17, 5)\nprint(f\"商：{q}，余数：{r}\")\n\n# 可变默认参数陷阱：用None代替[]\ndef append_to(item, target=None):\n    if target is None:\n        target = []\n    target.append(item)\n    return target"}],
                "tags": ["参数传递", "可变参数", "返回值", "默认参数"],
                "formulas": [], "prerequisites": ["函数定义与调用"], "related_concepts": ["作用域与闭包"],
            },
            {
                "title": "作用域与闭包",
                "order_index": 3, "difficulty_level": "intermediate", "importance": "core",
                "definition": "作用域是变量的可访问范围，Python有局部作用域、嵌套作用域、全局作用域和内置作用域四个层级。闭包是指内部函数引用了外部函数的变量，并且外部函数已经返回的情况。",
                "content": "Python的作用域规则遵循LEGB原则，查找变量时依次搜索：L（Local）→ E（Enclosing）→ G（Global）→ B（Built-in）。\n\nglobal关键字：在函数内声明变量为全局变量。\nnonlocal关键字：在嵌套函数中声明变量为外层函数的变量。\n\n闭包的条件：1.存在嵌套函数 2.内部函数引用了外部函数的变量 3.外部函数返回内部函数\n\n闭包的应用：数据封装、延迟计算、装饰器的基础。\n\n装饰器是闭包的重要应用，用于在不修改原函数代码的情况下扩展函数功能。使用@语法糖可以简洁地应用装饰器。",
                "examples": [{"title": "作用域与闭包示例", "code": "def make_counter():\n    count = 0\n    def counter():\n        nonlocal count\n        count += 1\n        return count\n    return counter\n\nc = make_counter()\nprint(c())  # 1\nprint(c())  # 2\nprint(c())  # 3\n\ndef timer(func):\n    import time\n    def wrapper(*args, **kwargs):\n        start = time.time()\n        result = func(*args, **kwargs)\n        end = time.time()\n        print(f\"{func.__name__}执行时间：{end-start:.4f}秒\")\n        return result\n    return wrapper\n\n@timer\ndef slow_function():\n    import time\n    time.sleep(1)"}],
                "tags": ["作用域", "闭包", "装饰器", "LEGB", "nonlocal"],
                "formulas": [], "prerequisites": ["函数定义与调用", "参数传递与返回值"], "related_concepts": ["模块与包"],
            },
            {
                "title": "模块与包",
                "order_index": 4, "difficulty_level": "beginner", "importance": "core",
                "definition": "模块是包含Python代码的文件，包是包含多个模块的目录。模块和包是Python组织代码的基本方式，通过导入机制实现代码的复用和分层管理。",
                "content": "模块是一个.py文件，使用import语句导入。导入方式：import 模块名、from 模块名 import 函数名、import 模块名 as 别名。\n\n包是包含__init__.py文件的目录。\n\n__name__变量：当模块被直接运行时，__name__为'__main__'；被导入时为模块名。常用模式：if __name__ == '__main__':\n\n模块搜索路径：Python按照sys.path列表中的目录顺序搜索模块。\n\n常用标准库模块：os、sys、math、random、datetime、json、re等。",
                "examples": [{"title": "模块导入与使用", "code": "import math\nprint(math.pi)\nprint(math.sqrt(16))\n\nfrom datetime import datetime\nnow = datetime.now()\nprint(now.strftime('%Y年%m月%d日'))\n\nimport random as rnd\nprint(rnd.choice(['苹果', '香蕉', '橙子']))"}],
                "tags": ["模块", "包", "导入", "__name__", "标准库"],
                "formulas": [], "prerequisites": ["函数定义与调用"], "related_concepts": ["开发环境搭建", "上下文管理器"],
            },
        ],
        "teaching_cases": [
            {
                "title": "数学工具库开发",
                "case_type": "application",
                "background": "在科学计算和数据分析中，经常需要使用各种数学函数。通过开发自己的数学工具库，可以学习模块化编程的思想。",
                "problem_description": "开发一个数学工具库模块，包含数列求和、素数判断、最大公约数、排列组合等函数，并编写测试代码验证功能正确性。",
                "analysis": "1. 设计模块结构，确定需要实现的函数\n2. 每个函数实现单一功能，参数和返回值明确\n3. 编写文档字符串说明函数用法\n4. 使用if __name__ == '__main__'编写测试代码",
                "solution": "将不同功能的函数分组放在同一个模块中，每个函数有清晰的文档字符串。使用__name__守卫编写测试代码。",
                "conclusion": "通过开发数学工具库，实践了函数定义、参数设计、模块组织和代码测试等关键技能。良好的模块设计应该功能单一、接口清晰、文档完善。",
                "code_example": "# math_tools.py\ndef fibonacci(n):\n    fib = [0, 1]\n    for i in range(2, n):\n        fib.append(fib[-1] + fib[-2])\n    return fib[:n]\n\ndef is_prime(n):\n    if n < 2:\n        return False\n    for i in range(2, int(n**0.5) + 1):\n        if n % i == 0:\n            return False\n    return True\n\ndef gcd(a, b):\n    while b:\n        a, b = b, a % b\n    return a\n\ndef combination(n, k):\n    if k > n or k < 0:\n        return 0\n    if k == 0 or k == n:\n        return 1\n    k = min(k, n - k)\n    result = 1\n    for i in range(k):\n        result = result * (n - i) // (i + 1)\n    return result\n\nif __name__ == '__main__':\n    print(fibonacci(10))\n    print(is_prime(7))\n    print(gcd(12, 18))\n    print(combination(5, 2))",
                "difficulty_level": "intermediate",
                "tags": ["模块化编程", "数学工具", "函数设计", "代码复用"],
            },
        ],
        "exercises": [
            {
                "title": "函数参数",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下关于Python函数参数的描述，哪个是正确的？",
                "options": ["函数定义时，默认参数必须放在可变参数*args后面", "**kwargs收集的关键字参数存储在列表中", "可变默认参数在函数定义时只创建一次", "关键字参数调用时必须按定义顺序传递"],
                "correct_answer": 2,
                "answer_analysis": "可变默认参数（如列表、字典）在函数定义时只创建一次，多次调用共享同一个对象，这就是可变默认参数陷阱的原因。",
                "hints": ["思考可变默认参数陷阱的原因", "**kwargs收集的是什么类型？"],
                "knowledge_tags": ["函数参数", "默认参数", "可变参数"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "闭包理解",
                "exercise_type": "choice",
                "difficulty_level": "intermediate",
                "content": "以下代码的输出结果是什么？\ndef outer():\n    x = 10\n    def inner():\n        nonlocal x\n        x += 5\n        return x\n    return inner\n\nf = outer()\nprint(f(), f())",
                "options": ["15 15", "15 20", "10 15", "报错"],
                "correct_answer": 1,
                "answer_analysis": "outer()返回inner函数的引用，形成闭包。第一次调用f()时x从10变为15返回15；第二次调用f()时x从15变为20返回20。所以输出15 20。",
                "hints": ["闭包会保留外部函数的变量", "nonlocal关键字的作用是什么？"],
                "knowledge_tags": ["闭包", "nonlocal", "作用域"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "装饰器编程",
                "exercise_type": "short_answer",
                "difficulty_level": "intermediate",
                "content": "请编写一个装饰器log_call，在被装饰的函数调用前后分别打印\"开始调用函数名\"和\"结束调用函数名\"，并返回原函数的结果。",
                "correct_answer": "def log_call(func):\n    def wrapper(*args, **kwargs):\n        print(f\"开始调用{func.__name__}\")\n        result = func(*args, **kwargs)\n        print(f\"结束调用{func.__name__}\")\n        return result\n    return wrapper",
                "answer_analysis": "装饰器是一个接收函数作为参数并返回新函数的高阶函数。wrapper函数在调用原函数前后添加日志输出，使用*args和**kwargs接收任意参数以保持通用性。",
                "hints": ["装饰器本质是闭包", "wrapper函数需要接收任意参数"],
                "knowledge_tags": ["装饰器", "闭包", "高阶函数"],
                "score": 10.0,
                "estimated_minutes": 8,
            },
        ],
    }
    chapters.append(ch4)

    # 第5章
    ch5 = {
        "title": "第5章 面向对象编程",
        "order_index": 5,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "介绍面向对象编程的核心概念，包括类与对象、封装、继承、多态和特殊方法，培养学生使用面向对象思想设计程序的能力。",
        "objectives": ["理解类与对象的概念和关系", "掌握封装和属性管理的实现方法", "理解继承与多态的原理和应用", "掌握特殊方法和运算符重载的使用"],
        "key_points": ["类与对象", "封装与属性", "继承与多态", "特殊方法与运算符重载"],
        "difficulties": ["多重继承与方法解析顺序", "描述符协议", "元类"],
        "teaching_methods": ["讲授", "案例驱动", "上机实践"],
        "knowledge_points": [
            {
                "title": "类与对象",
                "order_index": 1, "difficulty_level": "beginner", "importance": "core",
                "definition": "类是对象的蓝图或模板，定义了对象的属性和方法。对象是类的实例，通过类创建具体的实体。面向对象编程将数据和操作数据的方法封装在一起。",
                "content": "使用class关键字定义类，__init__方法是构造函数，在创建对象时自动调用。self参数代表对象实例本身。\n\n类属性属于类本身，所有实例共享；实例属性属于各个对象，互不影响。\n\n实例方法第一个参数为self，类方法使用@classmethod装饰器，静态方法使用@staticmethod装饰器。\n\n__str__方法定义对象的字符串表示，print()时自动调用。",
                "examples": [{"title": "类与对象定义", "code": "class Student:\n    school = '某某大学'\n    count = 0\n    \n    def __init__(self, name, age, major):\n        self.name = name\n        self.age = age\n        self.major = major\n        Student.count += 1\n    \n    def introduce(self):\n        return f\"我是{self.name}，{self.age}岁，{self.major}专业\"\n    \n    @classmethod\n    def get_count(cls):\n        return cls.count\n    \n    @staticmethod\n    def is_adult(age):\n        return age >= 18\n\ns1 = Student('张三', 20, '计算机')\ns2 = Student('李四', 21, '数学')\nprint(s1.introduce())\nprint(Student.get_count())  # 2"}],
                "tags": ["类", "对象", "实例化", "构造函数", "self"],
                "formulas": [], "prerequisites": ["函数定义与调用"], "related_concepts": ["封装与属性", "继承与多态"],
            },
            {
                "title": "封装与属性",
                "order_index": 2, "difficulty_level": "intermediate", "importance": "core",
                "definition": "封装是将数据和操作数据的方法绑定在一起，并控制外部对内部数据的访问权限。Python通过命名约定和property机制实现封装。",
                "content": "Python的封装约定：\n- 公有属性：直接以名称定义\n- 保护属性：以单下划线开头，约定不直接访问\n- 私有属性：以双下划线开头，名称会被改写\n\nproperty装饰器用于创建受控的属性访问：@property定义getter，@属性名.setter定义setter。\n\n使用property的优势：可以在赋值时进行数据验证、在访问时计算派生值、保持接口一致性。",
                "examples": [{"title": "封装与property", "code": "class BankAccount:\n    def __init__(self, owner, balance=0):\n        self.owner = owner\n        self.__balance = balance\n    \n    @property\n    def balance(self):\n        return self.__balance\n    \n    @balance.setter\n    def balance(self, amount):\n        if amount < 0:\n            raise ValueError('余额不能为负数')\n        self.__balance = amount\n    \n    def deposit(self, amount):\n        if amount <= 0:\n            raise ValueError('存款金额必须大于0')\n        self.__balance += amount\n\nacc = BankAccount('张三', 1000)\nacc.deposit(500)\nprint(acc.balance)  # 1500"}],
                "tags": ["封装", "私有属性", "property", "数据隐藏"],
                "formulas": [], "prerequisites": ["类与对象"], "related_concepts": ["特殊方法与运算符重载"],
            },
            {
                "title": "继承与多态",
                "order_index": 3, "difficulty_level": "intermediate", "importance": "core",
                "definition": "继承是子类获得父类属性和方法的机制，实现代码复用和层次化设计。多态是同一接口在不同对象上有不同实现的特性，通过方法重写实现运行时动态绑定。",
                "content": "继承语法：class 子类(父类):。子类自动获得父类的所有属性和方法，可以添加或重写方法。\n\nsuper()函数用于调用父类的方法。\n\n方法重写：子类定义与父类同名的方法，调用时使用子类的版本。这是实现多态的基础。\n\n多态的意义：不同类型的对象可以响应相同的接口，调用者不需要知道对象的具体类型。\n\n多重继承：一个子类可以继承多个父类。方法解析顺序（MRO）使用C3线性化算法确定。",
                "examples": [{"title": "继承与多态", "code": "class Animal:\n    def __init__(self, name):\n        self.name = name\n    def speak(self):\n        raise NotImplementedError\n\nclass Dog(Animal):\n    def speak(self):\n        return f'{self.name}说：汪汪！'\n\nclass Cat(Animal):\n    def speak(self):\n        return f'{self.name}说：喵喵！'\n\ndef animal_concert(animals):\n    for animal in animals:\n        print(animal.speak())\n\nanimals = [Dog('旺财'), Cat('咪咪')]\nanimal_concert(animals)"}],
                "tags": ["继承", "多态", "方法重写", "super", "MRO"],
                "formulas": [], "prerequisites": ["类与对象", "封装与属性"], "related_concepts": ["特殊方法与运算符重载"],
            },
            {
                "title": "特殊方法与运算符重载",
                "order_index": 4, "difficulty_level": "intermediate", "importance": "supplementary",
                "definition": "特殊方法（魔术方法）是以双下划线开头和结尾的方法，用于定义对象在内置操作中的行为，实现运算符重载。",
                "content": "常用特殊方法：\n- __init__：构造函数\n- __str__/__repr__：字符串表示\n- __eq__/__lt__/__gt__等：比较运算符\n- __add__/__sub__/__mul__等：算术运算符\n- __len__/__getitem__/__contains__：容器协议\n- __call__：可调用对象\n\n运算符重载让自定义类型的对象支持内置运算符，使代码更直观自然。",
                "examples": [{"title": "运算符重载示例", "code": "class Vector:\n    def __init__(self, x, y):\n        self.x = x\n        self.y = y\n    def __add__(self, other):\n        return Vector(self.x + other.x, self.y + other.y)\n    def __mul__(self, scalar):\n        return Vector(self.x * scalar, self.y * scalar)\n    def __abs__(self):\n        return (self.x**2 + self.y**2) ** 0.5\n    def __repr__(self):\n        return f'Vector({self.x}, {self.y})'\n\nv1 = Vector(3, 4)\nv2 = Vector(1, 2)\nprint(v1 + v2)      # Vector(4, 6)\nprint(abs(v1))      # 5.0"}],
                "tags": ["特殊方法", "运算符重载", "魔术方法", "容器协议"],
                "formulas": [], "prerequisites": ["类与对象", "继承与多态"], "related_concepts": ["封装与属性"],
            },
        ],
        "teaching_cases": [
            {
                "title": "图书馆管理系统",
                "case_type": "application",
                "background": "图书馆管理系统是面向对象编程的经典案例，涉及图书、读者、借阅记录等多个实体，非常适合用面向对象方法来设计。",
                "problem_description": "使用面向对象方法设计一个简易图书馆管理系统，实现图书管理、读者管理和借阅管理功能。",
                "analysis": "1. 识别核心类：Book、Reader、Library\n2. Book类封装图书信息\n3. Reader类封装读者信息\n4. Library类管理图书和读者\n5. 扩展Reader子类体现继承和多态",
                "solution": "设计Book、Reader及其子类、Library等类，通过封装保护数据完整性，通过继承实现读者分类，通过多态实现不同借阅规则。",
                "conclusion": "图书馆管理系统充分展示了面向对象编程的优势：封装保护数据、继承复用代码、多态灵活扩展。",
                "code_example": "class Book:\n    def __init__(self, title, author, isbn):\n        self.title = title\n        self.author = author\n        self.isbn = isbn\n        self._is_borrowed = False\n    \n    @property\n    def is_available(self):\n        return not self._is_borrowed\n\nclass Reader:\n    def __init__(self, name, reader_id):\n        self.name = name\n        self.reader_id = reader_id\n        self._borrowed_books = []\n    \n    @property\n    def max_borrow(self):\n        return 3\n    \n    def borrow(self, book):\n        if len(self._borrowed_books) >= self.max_borrow:\n            return f'{self.name}已达借阅上限'\n        if not book.is_available:\n            return f'《{book.title}》已被借出'\n        book._is_borrowed = True\n        self._borrowed_books.append(book)\n        return f'{self.name}成功借阅《{book.title}》'\n\nclass TeacherReader(Reader):\n    @property\n    def max_borrow(self):\n        return 5\n\nclass Library:\n    def __init__(self, name):\n        self.name = name\n        self.books = []\n        self.readers = []\n    \n    def add_book(self, book):\n        self.books.append(book)\n    \n    def find_book(self, title):\n        return [b for b in self.books if title in b.title]",
                "difficulty_level": "intermediate",
                "tags": ["面向对象", "封装", "继承", "多态", "图书馆"],
            },
        ],
        "exercises": [
            {
                "title": "类属性与实例属性",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下代码的输出结果是什么？\nclass Counter:\n    count = 0\n    def __init__(self):\n        Counter.count += 1\n        self.count = 10\n\nc1 = Counter()\nc2 = Counter()\nprint(Counter.count, c1.count, c2.count)",
                "options": ["2 10 10", "2 2 2", "0 10 10", "2 1 1"],
                "correct_answer": 0,
                "answer_analysis": "每次创建对象时Counter.count递增1，创建两个对象后Counter.count=2。self.count=10创建了实例属性，所以c1.count和c2.count都是10。",
                "hints": ["区分类属性和实例属性", "self.count = 10创建的是实例属性"],
                "knowledge_tags": ["类属性", "实例属性", "属性查找"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "继承与方法重写",
                "exercise_type": "choice",
                "difficulty_level": "intermediate",
                "content": "以下关于Python继承的描述，哪个是错误的？",
                "options": ["子类可以调用super()访问父类方法", "子类重写的方法会覆盖父类的同名方法", "Python支持多重继承", "子类必须调用父类的__init__方法"],
                "correct_answer": 3,
                "answer_analysis": "子类不是必须调用父类的__init__方法。如果子类定义了自己的__init__且不需要父类的初始化逻辑，可以不调用super().__init__()。",
                "hints": ["子类是否一定需要父类的初始化？", "考虑子类完全自定义__init__的情况"],
                "knowledge_tags": ["继承", "方法重写", "super"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "面向对象设计",
                "exercise_type": "short_answer",
                "difficulty_level": "intermediate",
                "content": "请设计一个Shape基类和Circle、Rectangle两个子类。基类定义area()抽象方法，子类分别实现面积计算。要求使用property装饰器实现只读的面积属性。",
                "correct_answer": "import math\n\nclass Shape:\n    @property\n    def area(self):\n        raise NotImplementedError('子类必须实现area属性')\n\nclass Circle(Shape):\n    def __init__(self, radius):\n        self.radius = radius\n    @property\n    def area(self):\n        return math.pi * self.radius ** 2\n\nclass Rectangle(Shape):\n    def __init__(self, width, height):\n        self.width = width\n        self.height = height\n    @property\n    def area(self):\n        return self.width * self.height",
                "answer_analysis": "使用@property将area定义为只读属性，子类通过重写area属性实现多态。Shape基类中area抛出NotImplementedError强制子类实现。",
                "hints": ["使用@property装饰器定义属性", "基类中可以抛出NotImplementedError"],
                "knowledge_tags": ["面向对象", "继承", "多态", "property"],
                "score": 10.0,
                "estimated_minutes": 8,
            },
        ],
    }
    chapters.append(ch5)

    # 第6章
    ch6 = {
        "title": "第6章 文件操作与异常处理",
        "order_index": 6,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "讲解文件读写操作、目录管理、异常处理机制和上下文管理器，使学生掌握程序与外部数据交互和错误处理的能力。",
        "objectives": ["掌握文件的打开、读写和关闭操作", "了解文件与目录的管理方法", "掌握异常处理机制和自定义异常", "理解上下文管理器的作用和使用"],
        "key_points": ["文件读写操作", "文件与目录管理", "异常处理机制", "上下文管理器"],
        "difficulties": ["异常处理的最佳实践", "上下文管理器协议", "编码问题"],
        "teaching_methods": ["讲授", "案例演示", "上机实践"],
        "knowledge_points": [
            {
                "title": "文件读写操作",
                "order_index": 1, "difficulty_level": "beginner", "importance": "core",
                "definition": "文件读写操作是程序与外部存储交换数据的基本方式。Python通过open()函数打开文件，提供读、写、追加等多种模式。",
                "content": "open()函数的基本用法：open(文件路径, 模式, 编码)。常用模式：'r'只读、'w'写入（覆盖）、'a'追加、'b'二进制。\n\n读取方法：read()全部读取、readline()读取一行、readlines()读取所有行、for line in file逐行迭代（推荐）。\n\n写入方法：write()写入字符串、writelines()写入列表。\n\n文件操作完成后必须关闭文件，推荐使用with语句自动关闭。\n\n编码问题：处理中文文件时应指定encoding='utf-8'参数。",
                "examples": [{"title": "文件读写操作", "code": "with open('data.txt', 'w', encoding='utf-8') as f:\n    f.write('姓名,年龄,成绩\\n')\n    f.write('张三,20,92\\n')\n\nwith open('data.txt', 'r', encoding='utf-8') as f:\n    for line in f:\n        print(line.strip())\n\nwith open('data.txt', 'a', encoding='utf-8') as f:\n    f.write('李四,21,85\\n')"}],
                "tags": ["文件操作", "读写", "编码", "with语句"],
                "formulas": [], "prerequisites": ["输入输出操作", "字符串"], "related_concepts": ["文件与目录管理", "上下文管理器"],
            },
            {
                "title": "文件与目录管理",
                "order_index": 2, "difficulty_level": "beginner", "importance": "core",
                "definition": "文件与目录管理是对文件系统进行操作的能力，包括路径处理、目录遍历、文件重命名和删除等。Python通过os和pathlib模块提供跨平台的文件系统操作接口。",
                "content": "os模块提供操作系统相关的功能：getcwd()、chdir()、listdir()、mkdir()、remove()、rename()等。\n\npathlib模块（推荐）提供面向对象的路径操作：Path()、.exists()、.is_file()、.parent、.stem、.suffix、.glob()等。\n\n路径拼接推荐使用os.path.join()或Path的/运算符。",
                "examples": [{"title": "文件与目录管理", "code": "from pathlib import Path\n\np = Path('data')\np.mkdir(exist_ok=True)\nfile_path = p / 'test.txt'\nfile_path.write_text('你好，世界！', encoding='utf-8')\nprint(file_path.read_text(encoding='utf-8'))\nprint(file_path.stem)    # test\nprint(file_path.suffix)  # .txt"}],
                "tags": ["文件管理", "目录", "pathlib", "os模块", "路径"],
                "formulas": [], "prerequisites": ["文件读写操作"], "related_concepts": ["上下文管理器"],
            },
            {
                "title": "异常处理机制",
                "order_index": 3, "difficulty_level": "intermediate", "importance": "core",
                "definition": "异常处理是程序运行时错误的捕获和处理机制，使用try-except语句捕获异常，防止程序因错误而意外终止。",
                "content": "try-except基本语法，完整结构：try-except-else-finally。\n- else：没有异常时执行\n- finally：无论是否异常都执行\n\n常见异常类型：ValueError、TypeError、FileNotFoundError、KeyError、IndexError、ZeroDivisionError。\n\n异常处理最佳实践：\n1. 不要使用空的except\n2. 尽量捕获具体的异常类型\n3. 使用finally确保资源释放\n\n自定义异常：继承Exception类。raise语句用于主动抛出异常。",
                "examples": [{"title": "异常处理与自定义异常", "code": "try:\n    num = int(input('请输入数字：'))\n    result = 100 / num\nexcept ValueError:\n    print('输入的不是有效数字')\nexcept ZeroDivisionError:\n    print('除数不能为零')\nelse:\n    print(f'结果是：{result}')\nfinally:\n    print('计算结束')\n\nclass ScoreError(Exception):\n    def __init__(self, score):\n        self.score = score\n        super().__init__(f'成绩{score}无效')\n\ntry:\n    raise ScoreError(150)\nexcept ScoreError as e:\n    print(e)"}],
                "tags": ["异常处理", "try-except", "自定义异常", "错误处理"],
                "formulas": [], "prerequisites": ["函数定义与调用"], "related_concepts": ["上下文管理器", "文件读写操作"],
            },
            {
                "title": "上下文管理器",
                "order_index": 4, "difficulty_level": "intermediate", "importance": "supplementary",
                "definition": "上下文管理器是实现了__enter__和__exit__方法的对象，用于管理资源的获取和释放。with语句确保资源在使用后正确释放。",
                "content": "with语句的执行流程：调用__enter__→执行代码块→调用__exit__。\n\n自定义上下文管理器有两种方式：\n1. 类实现：定义__enter__和__exit__方法\n2. contextlib.contextmanager装饰器：使用yield语句\n\n典型应用：文件操作、数据库连接、锁的获取与释放、计时器。",
                "examples": [{"title": "自定义上下文管理器", "code": "import time\nfrom contextlib import contextmanager\n\nclass Timer:\n    def __enter__(self):\n        self.start = time.time()\n        return self\n    def __exit__(self, *args):\n        self.end = time.time()\n        print(f'耗时：{self.end - self.start:.4f}秒')\n\nwith Timer():\n    time.sleep(1)\n\n@contextmanager\ndef temp_dir(path):\n    import os\n    old_dir = os.getcwd()\n    os.chdir(path)\n    try:\n        yield path\n    finally:\n        os.chdir(old_dir)"}],
                "tags": ["上下文管理器", "with语句", "__enter__", "__exit__", "资源管理"],
                "formulas": [], "prerequisites": ["类与对象", "异常处理机制"], "related_concepts": ["文件读写操作", "数据库操作"],
            },
        ],
        "teaching_cases": [
            {
                "title": "日志分析工具",
                "case_type": "application",
                "background": "服务器日志是排查问题和性能分析的重要数据源。日志文件通常很大，需要编写程序自动分析提取关键信息。",
                "problem_description": "编写一个日志分析工具，能够读取日志文件，统计不同级别的日志数量，提取错误信息，并生成分析报告。",
                "analysis": "1. 日志格式：时间戳、级别、模块、消息\n2. 逐行读取大文件避免内存溢出\n3. 使用字典统计各级别数量\n4. 使用异常处理应对格式错误",
                "solution": "使用with语句安全读取文件，逐行解析，字典统计，异常处理保证健壮性。",
                "conclusion": "日志分析工具综合运用了文件操作、异常处理、数据结构等知识。逐行读取比一次性读取更节省内存。",
                "code_example": "from collections import defaultdict\n\ndef analyze_log(log_path):\n    level_count = defaultdict(int)\n    errors = []\n    try:\n        with open(log_path, 'r', encoding='utf-8') as f:\n            for line_num, line in enumerate(f, 1):\n                line = line.strip()\n                if not line:\n                    continue\n                try:\n                    parts = line.split(' - ')\n                    if len(parts) >= 3:\n                        level = parts[1].strip()\n                        level_count[level] += 1\n                        if level == 'ERROR':\n                            errors.append((line_num, line))\n                except Exception:\n                    continue\n    except FileNotFoundError:\n        print(f'日志文件不存在：{log_path}')\n        return\n    print('日志级别统计：')\n    for level, count in sorted(level_count.items()):\n        print(f'  {level}: {count}条')\n    if errors:\n        print(f'\\n错误详情（共{len(errors)}条）：')\n        for line_num, msg in errors[:10]:\n            print(f'  行{line_num}: {msg[:80]}')",
                "difficulty_level": "intermediate",
                "tags": ["日志分析", "文件读取", "异常处理", "统计"],
            },
        ],
        "exercises": [
            {
                "title": "文件操作",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下关于Python文件操作的描述，哪个是正确的？",
                "options": ["open()以'w'模式打开文件时，文件不存在会报错", "readline()可以一次性读取文件所有内容", "with语句会在代码块结束后自动关闭文件", "文件只能以文本模式打开"],
                "correct_answer": 2,
                "answer_analysis": "with语句会在代码块执行完毕后自动调用close()方法，即使发生异常也会正确关闭文件。",
                "hints": ["with语句的核心作用是什么？", "'w'模式对文件不存在的处理？"],
                "knowledge_tags": ["文件操作", "with语句", "文件模式"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "异常处理",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下代码的输出结果是什么？\ntry:\n    result = 10 / 0\nexcept ZeroDivisionError:\n    print('A')\nexcept Exception:\n    print('B')\nelse:\n    print('C')\nfinally:\n    print('D')",
                "options": ["A D", "B D", "A C D", "A B D"],
                "correct_answer": 0,
                "answer_analysis": "10/0抛出ZeroDivisionError被第一个except捕获打印A。由于发生了异常else不执行。finally总是执行打印D。输出A D。",
                "hints": ["else块在什么情况下执行？", "finally块是否总是执行？"],
                "knowledge_tags": ["异常处理", "try-except", "else", "finally"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "文件处理编程",
                "exercise_type": "short_answer",
                "difficulty_level": "intermediate",
                "content": "请编写一个函数，读取一个文本文件，统计其中每个单词出现的次数，返回一个按出现次数从高到低排序的列表，每个元素为(单词, 次数)的元组。",
                "correct_answer": "def count_words(file_path):\n    word_count = {}\n    with open(file_path, 'r', encoding='utf-8') as f:\n        for line in f:\n            words = line.strip().split()\n            for word in words:\n                word = word.lower().strip('.,!?;:\"\\'')\n                if word:\n                    word_count[word] = word_count.get(word, 0) + 1\n    return sorted(word_count.items(), key=lambda x: x[1], reverse=True)",
                "answer_analysis": "使用with语句安全读取文件，逐行分割为单词，字典统计频次，最后按值降序排序。",
                "hints": ["使用字典统计频次", "sorted函数的key参数可以指定排序依据"],
                "knowledge_tags": ["文件读取", "字典统计", "排序", "字符串处理"],
                "score": 10.0,
                "estimated_minutes": 8,
            },
        ],
    }
    chapters.append(ch6)

    # 第7章
    ch7 = {
        "title": "第7章 常用标准库与数据处理",
        "order_index": 7,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "介绍Python常用标准库，包括日期时间处理、正则表达式、数据格式处理（JSON、XML、CSV）和数据处理库入门。",
        "objectives": ["掌握日期时间的处理方法", "理解正则表达式的基本语法和应用", "掌握常见数据格式的读写", "了解数据处理库的基本用法"],
        "key_points": ["日期时间处理", "正则表达式", "数据格式处理", "数据处理库入门"],
        "difficulties": ["正则表达式的语法和模式设计", "数据清洗和转换的实践技巧"],
        "teaching_methods": ["讲授", "案例演示", "上机实践"],
        "knowledge_points": [
            {
                "title": "日期时间处理",
                "order_index": 1, "difficulty_level": "beginner", "importance": "core",
                "definition": "日期时间处理是程序中常见的需求，Python通过datetime模块提供日期、时间、时间间隔的创建、计算和格式化功能。",
                "content": "datetime模块的核心类：date（日期）、time（时间）、datetime（日期时间）、timedelta（时间间隔）。\n\n常用操作：datetime.now()获取当前时间、strptime()字符串解析、strftime()格式化输出、timedelta日期运算。\n\n格式化符号：%Y年、%m月、%d日、%H时、%M分、%S秒。",
                "examples": [{"title": "日期时间操作", "code": "from datetime import datetime, timedelta, date\n\nnow = datetime.now()\nprint(now.strftime('%Y年%m月%d日 %H:%M:%S'))\n\ndt = datetime.strptime('2024-03-15', '%Y-%m-%d')\ntomorrow = now + timedelta(days=1)\n\nbirthday = date(2024, 6, 15)\ntoday = date.today()\ndays_left = (birthday - today).days\nprint(f'距离生日还有{days_left}天')"}],
                "tags": ["日期时间", "datetime", "格式化", "时间间隔"],
                "formulas": [], "prerequisites": ["变量与数据类型", "字符串"], "related_concepts": ["数据格式处理(JSON/XML/CSV)"],
            },
            {
                "title": "正则表达式",
                "order_index": 2, "difficulty_level": "intermediate", "importance": "core",
                "definition": "正则表达式是描述字符串匹配模式的形式化语言，用于文本的搜索、替换和验证。Python通过re模块提供正则表达式支持。",
                "content": "正则表达式基本语法：\n- 元字符：. ^ $ * + ? { } [ ] \\ | ( )\n- 字符类：[abc]、[a-z]、[^abc]\n- 预定义类：\\d数字、\\w单词字符、\\s空白\n- 量词：*零或多次、+一或多次、?零或一次、{n,m}\n- 锚点：^行首、$行尾、\\b单词边界\n- 分组：()捕获组、(?:)非捕获组\n\nre模块常用函数：match()、search()、findall()、sub()、split()。\n\n建议使用原始字符串r''编写正则表达式。",
                "examples": [{"title": "正则表达式应用", "code": "import re\n\nphone = '13812345678'\nprint(bool(re.match(r'^1[3-9]\\d{9}$', phone)))  # True\n\ntext = '联系方式：zhang@example.com 和 li@company.cn'\nemails = re.findall(r'[\\w.-]+@[\\w.-]+\\.\\w+', text)\nprint(emails)\n\ncontent = '密码是abc123，请勿泄露'\nsafe = re.sub(r'密码是\\S+', '密码是***', content)\nprint(safe)"}],
                "tags": ["正则表达式", "re模块", "模式匹配", "文本处理"],
                "formulas": [], "prerequisites": ["字符串", "列表"], "related_concepts": ["数据格式处理(JSON/XML/CSV)"],
            },
            {
                "title": "数据格式处理(JSON/XML/CSV)",
                "order_index": 3, "difficulty_level": "intermediate", "importance": "core",
                "definition": "数据格式处理是指对结构化数据进行解析和生成的能力。JSON（JSON）是轻量级数据交换格式，XML（XML）是通用标记语言，CSV（CSV）是表格数据的纯文本表示。",
                "content": "JSON（JSON）处理：json.dumps()序列化、json.loads()反序列化、json.dump()/json.load()直接读写文件。ensure_ascii=False保留中文。\n\nCSV（CSV）处理：csv.reader()/csv.writer()基本读写、csv.DictReader()/csv.DictWriter()字典方式读写。\n\nXML（XML）处理：xml.etree.ElementTree标准库解析。\n\n数据格式选择：JSON适合接口数据交换，CSV适合表格数据，XML适合配置文件和文档。",
                "examples": [{"title": "数据格式处理", "code": "import json\nimport csv\n\ndata = [{'姓名': '张三', '年龄': 20, '成绩': 92},\n        {'姓名': '李四', '年龄': 21, '成绩': 85}]\n\n# JSON\njson_str = json.dumps(data, ensure_ascii=False, indent=2)\nwith open('students.json', 'w', encoding='utf-8') as f:\n    json.dump(data, f, ensure_ascii=False, indent=2)\n\n# CSV\nwith open('students.csv', 'w', encoding='utf-8-sig', newline='') as f:\n    writer = csv.DictWriter(f, fieldnames=['姓名', '年龄', '成绩'])\n    writer.writeheader()\n    writer.writerows(data)"}],
                "tags": ["JSON", "JSON", "CSV", "CSV", "XML", "XML", "数据格式"],
                "formulas": [], "prerequisites": ["文件读写操作", "字典", "列表"], "related_concepts": ["数据处理库入门", "接口开发框架"],
            },
            {
                "title": "数据处理库入门",
                "order_index": 4, "difficulty_level": "intermediate", "importance": "supplementary",
                "definition": "数据处理库是专门用于数据分析和处理的第三方库，主要包括NumPy（数值计算）和pandas（数据分析），它们提供了高效的数据结构和计算工具。",
                "content": "NumPy核心概念：ndarray多维数组、向量化运算、常用统计函数。\n\npandas核心概念：Series一维数据、DataFrame二维表格、数据读取与选择、分组聚合与统计。\n\n这些库是数据科学和机器学习的基础工具。",
                "examples": [{"title": "NumPy与pandas基础", "code": "import numpy as np\nimport pandas as pd\n\nscores = np.array([85, 92, 78, 95, 88])\nprint(f'平均分：{scores.mean():.1f}')\nprint(f'最高分：{scores.max()}')\n\ndata = {'姓名': ['张三', '李四', '王五', '赵六'],\n        '班级': ['A班', 'B班', 'A班', 'B班'],\n        '成绩': [92, 85, 78, 95]}\ndf = pd.DataFrame(data)\nprint(df.describe())\nprint(df.groupby('班级')['成绩'].mean())"}],
                "tags": ["NumPy", "pandas", "数据处理", "数据分析", "DataFrame"],
                "formulas": [], "prerequisites": ["列表", "字典", "数据格式处理(JSON/XML/CSV)"], "related_concepts": ["网络编程与接口开发"],
            },
        ],
        "teaching_cases": [
            {
                "title": "天气数据采集与分析",
                "case_type": "application",
                "background": "天气数据分析是数据处理的典型应用场景。通过采集天气数据，进行清洗、转换和统计分析，可以发现天气变化的规律。",
                "problem_description": "编写程序读取天气数据文件（CSV格式），进行数据清洗和统计分析，计算平均温度、最高最低温度等，并生成分析报告。",
                "analysis": "1. 使用csv模块读取CSV格式数据\n2. 使用pandas进行数据清洗\n3. 使用NumPy进行数值计算\n4. 将结果输出为JSON格式",
                "solution": "使用pandas读取CSV数据，进行数据清洗和统计分析，最后将结果导出为JSON格式。",
                "conclusion": "天气数据分析案例综合运用了CSV读取、数据清洗、统计分析和JSON输出等技能。",
                "code_example": "import pandas as pd\nimport numpy as np\nimport json\nfrom io import StringIO\n\nweather_data = '''日期,城市,最高温,最低温,天气\n2024-03-01,北京,12,2,晴\n2024-03-02,北京,15,5,多云\n2024-03-03,北京,10,1,阴\n2024-03-04,北京,18,8,晴\n2024-03-05,北京,20,10,晴'''\n\ndf = pd.read_csv(StringIO(weather_data))\nresult = {\n    '平均最高温': float(df['最高温'].mean()),\n    '平均最低温': float(df['最低温'].mean()),\n    '最高温度': int(df['最高温'].max()),\n    '最低温度': int(df['最低温'].min()),\n    '晴天占比': f\"{(df['天气']=='晴').sum() / len(df) * 100:.1f}%\",\n}\nprint(json.dumps(result, ensure_ascii=False, indent=2))",
                "difficulty_level": "intermediate",
                "tags": ["天气数据", "CSV", "pandas", "数据分析", "JSON"],
            },
        ],
        "exercises": [
            {
                "title": "日期时间处理",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下代码的输出结果是什么？\nfrom datetime import datetime, timedelta\ndt = datetime(2024, 3, 15)\nresult = dt + timedelta(days=10)\nprint(result.strftime('%Y-%m-%d'))",
                "options": ["2024-03-25", "2024-03-05", "2024-04-25", "2024-04-05"],
                "correct_answer": 0,
                "answer_analysis": "datetime(2024,3,15)加10天等于2024年3月25日，格式化输出为2024-03-25。",
                "hints": ["3月15日加10天是几号？", "注意timedelta的days参数"],
                "knowledge_tags": ["日期时间", "timedelta", "格式化"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "正则表达式匹配",
                "exercise_type": "choice",
                "difficulty_level": "intermediate",
                "content": "正则表达式 r'\\d{3}-\\d{4}' 能匹配以下哪个字符串？",
                "options": ["1234567", "123-4567", "12-34567", "1234-567"],
                "correct_answer": 1,
                "answer_analysis": "r'\\d{3}-\\d{4}'表示3个数字+连字符+4个数字。只有'123-4567'符合这个模式。",
                "hints": ["\\d{3}表示3个数字", "-匹配字面连字符"],
                "knowledge_tags": ["正则表达式", "模式匹配", "量词"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "数据格式转换",
                "exercise_type": "short_answer",
                "difficulty_level": "intermediate",
                "content": "请编写代码，将以下JSON字符串解析为Python对象，提取所有学生的姓名和成绩，然后写入CSV文件：\njson_str = '[{\"姓名\":\"张三\",\"成绩\":92},{\"姓名\":\"李四\",\"成绩\":85},{\"姓名\":\"王五\",\"成绩\":78}]'",
                "correct_answer": "import json\nimport csv\n\njson_str = '[{\"姓名\":\"张三\",\"成绩\":92},{\"姓名\":\"李四\",\"成绩\":85},{\"姓名\":\"王五\",\"成绩\":78}]'\nstudents = json.loads(json_str)\n\nwith open('grades.csv', 'w', encoding='utf-8-sig', newline='') as f:\n    writer = csv.DictWriter(f, fieldnames=['姓名', '成绩'])\n    writer.writeheader()\n    for s in students:\n        writer.writerow({'姓名': s['姓名'], '成绩': s['成绩']})",
                "answer_analysis": "使用json.loads()解析JSON字符串为Python列表，然后使用csv.DictWriter将数据写入CSV文件。注意encoding='utf-8-sig'确保中文正确显示。",
                "hints": ["json.loads()解析字符串", "csv.DictWriter写入字典数据"],
                "knowledge_tags": ["JSON", "CSV", "数据转换", "JSON解析"],
                "score": 10.0,
                "estimated_minutes": 8,
            },
        ],
    }
    chapters.append(ch7)

    # 第8章
    ch8 = {
        "title": "第8章 网络编程与接口开发",
        "order_index": 8,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "介绍网络编程基础、接口开发框架、数据库操作和项目工程化实践，使学生具备开发网络应用和接口服务的能力。",
        "objectives": ["了解网络基础和套接字编程", "掌握接口开发框架的基本用法", "掌握数据库操作的基本方法", "了解项目工程化的基本实践"],
        "key_points": ["网络基础与套接字编程", "接口开发框架", "数据库操作", "项目工程化实践"],
        "difficulties": ["接口设计原则", "数据库ORM映射", "项目结构与配置管理"],
        "teaching_methods": ["讲授", "项目驱动", "上机实践"],
        "knowledge_points": [
            {
                "title": "网络基础与套接字编程",
                "order_index": 1, "difficulty_level": "intermediate", "importance": "core",
                "definition": "网络编程是通过套接字（Socket）实现进程间网络通信的编程方式。套接字是网络通信的端点，提供了发送和接收数据的机制。",
                "content": "网络基础概念：IP地址、端口号、TCP/UDP协议。\n\n套接字编程基本流程：\n服务端：socket()→bind()→listen()→accept()→recv()/send()→close()\n客户端：socket()→connect()→send()/recv()→close()\n\nrequests库是HTTP客户端的推荐工具：requests.get()、requests.post()，响应对象.status_code、.json()、.text。",
                "examples": [{"title": "HTTP请求", "code": "import requests\n\nresponse = requests.get('https://api.example.com/data')\nif response.status_code == 200:\n    data = response.json()\n    print(data)\n\npayload = {'name': '张三', 'score': 92}\nresponse = requests.post(\n    'https://api.example.com/submit',\n    json=payload\n)\nprint(response.json())"}],
                "tags": ["网络编程", "套接字", "HTTP", "requests", "TCP"],
                "formulas": [], "prerequisites": ["模块与包", "异常处理机制"], "related_concepts": ["接口开发框架"],
            },
            {
                "title": "接口开发框架",
                "order_index": 2, "difficulty_level": "intermediate", "importance": "core",
                "definition": "接口开发框架是用于快速构建网络接口服务的工具，Flask是Python中最流行的轻量级接口开发框架，适合开发中小型接口服务。",
                "content": "Flask框架核心概念：路由（@app.route()）、视图函数、请求对象（request）、响应对象（jsonify()）。\n\n请求方法：GET获取、POST创建、PUT更新、DELETE删除。\n\n接口设计原则：URL使用名词、HTTP方法表示操作、返回合适状态码、使用JSON格式、提供清晰错误信息。",
                "examples": [{"title": "Flask接口开发", "code": "from flask import Flask, request, jsonify\n\napp = Flask(__name__)\ntodos = [{'id': 1, 'title': '学习Python', 'done': False}]\n\n@app.route('/api/todos', methods=['GET'])\ndef get_todos():\n    return jsonify(todos)\n\n@app.route('/api/todos', methods=['POST'])\ndef create_todo():\n    data = request.get_json()\n    new_todo = {'id': len(todos)+1, 'title': data.get('title',''), 'done': False}\n    todos.append(new_todo)\n    return jsonify(new_todo), 201\n\nif __name__ == '__main__':\n    app.run(debug=True)"}],
                "tags": ["Flask", "接口开发", "路由", "RESTful", "HTTP"],
                "formulas": [], "prerequisites": ["函数定义与调用", "装饰器", "数据格式处理(JSON/XML/CSV)"], "related_concepts": ["数据库操作", "项目工程化实践"],
            },
            {
                "title": "数据库操作",
                "order_index": 3, "difficulty_level": "intermediate", "importance": "core",
                "definition": "数据库操作是程序持久化存储和管理数据的核心能力。Python通过数据库驱动和ORM框架实现与数据库的交互，支持SQLite、MySQL、PostgreSQL等多种数据库。",
                "content": "SQLite是Python内置的轻量级数据库。\n\n原生SQL操作：connect()→cursor()→execute()→commit()→fetchall()→close()。\n\n参数化查询：使用?占位符防止SQL注入。\n\nSQLAlchemy是Python最流行的ORM框架：定义模型类映射数据库表，使用Python对象操作数据库。\n\nORM的优势：代码可读性好、数据库无关、防止SQL注入。",
                "examples": [{"title": "数据库操作", "code": "import sqlite3\n\nconn = sqlite3.connect('school.db')\ncursor = conn.cursor()\n\ncursor.execute('''\n    CREATE TABLE IF NOT EXISTS students (\n        id INTEGER PRIMARY KEY AUTOINCREMENT,\n        name TEXT NOT NULL,\n        age INTEGER,\n        score REAL\n    )\n''')\n\ncursor.execute('INSERT INTO students (name, age, score) VALUES (?, ?, ?)',\n              ('张三', 20, 92.5))\nconn.commit()\n\ncursor.execute('SELECT * FROM students WHERE score > ?', (80,))\nfor row in cursor.fetchall():\n    print(row)\n\nconn.close()"}],
                "tags": ["数据库", "SQLite", "SQL", "ORM", "SQLAlchemy"],
                "formulas": [], "prerequisites": ["文件读写操作", "类与对象"], "related_concepts": ["接口开发框架", "项目工程化实践"],
            },
            {
                "title": "项目工程化实践",
                "order_index": 4, "difficulty_level": "intermediate", "importance": "supplementary",
                "definition": "项目工程化是将软件开发过程中的规范、工具和流程系统化的实践，包括项目结构组织、配置管理、代码规范、测试和文档等方面。",
                "content": "项目结构组织：src/、tests/、config.py、requirements.txt等。\n\n配置管理：使用配置文件管理环境变量，不同环境使用不同配置，敏感信息不硬编码。\n\n代码规范：遵循PEP 8、有意义的命名、文档字符串、类型提示。\n\n测试：使用pytest编写单元测试，测试覆盖率目标80%以上。\n\n版本控制：使用Git管理代码版本，编写清晰的提交信息。",
                "examples": [{"title": "项目工程化示例", "code": "# config.py\nclass Config:\n    DEBUG = False\n    DATABASE = 'school.db'\n\nclass DevelopmentConfig(Config):\n    DEBUG = True\n\nclass ProductionConfig(Config):\n    DATABASE = 'production.db'\n\n# tests/test_math_tools.py\nimport pytest\nfrom src.math_tools import is_prime, gcd\n\ndef test_is_prime():\n    assert is_prime(7) == True\n    assert is_prime(4) == False\n\ndef test_gcd():\n    assert gcd(12, 18) == 6\n    assert gcd(7, 13) == 1"}],
                "tags": ["工程化", "项目结构", "配置管理", "代码规范", "测试"],
                "formulas": [], "prerequisites": ["模块与包", "异常处理机制", "接口开发框架"], "related_concepts": ["数据库操作"],
            },
        ],
        "teaching_cases": [
            {
                "title": "待办事项接口服务",
                "case_type": "application",
                "background": "待办事项管理是日常工作中常见的需求，通过开发接口服务，可以实现待办事项的增删改查，为前端应用提供数据支持。",
                "problem_description": "使用Flask框架开发一个待办事项接口服务，实现待办事项的创建、查询、更新和删除功能，使用SQLite数据库持久化存储数据。",
                "analysis": "1. 设计数据模型：编号、标题、完成状态、创建时间\n2. 设计接口：遵循RESTful风格\n3. 实现数据库操作：创建表、增删改查\n4. 实现接口路由：GET/POST/PUT/DELETE\n5. 异常处理：参数错误、资源不存在",
                "solution": "使用Flask构建接口服务，SQLite作为数据库，遵循RESTful设计原则。通过上下文管理器管理数据库连接。",
                "conclusion": "待办事项接口服务综合运用了接口开发、数据库操作、异常处理和项目工程化等知识。RESTful接口设计使接口语义清晰，数据库操作确保数据持久化。",
                "code_example": "from flask import Flask, request, jsonify, g\nimport sqlite3\nfrom datetime import datetime\n\napp = Flask(__name__)\nDATABASE = 'todos.db'\n\ndef get_db():\n    if 'db' not in g:\n        g.db = sqlite3.connect(DATABASE)\n        g.db.row_factory = sqlite3.Row\n    return g.db\n\n@app.teardown_appcontext\ndef close_db(exception):\n    db = g.pop('db', None)\n    if db is not None:\n        db.close()\n\n@app.route('/api/todos', methods=['GET'])\ndef list_todos():\n    db = get_db()\n    todos = db.execute('SELECT * FROM todos').fetchall()\n    return jsonify([dict(t) for t in todos])\n\n@app.route('/api/todos', methods=['POST'])\ndef create_todo():\n    data = request.get_json()\n    if not data or 'title' not in data:\n        return jsonify({'error': '标题不能为空'}), 400\n    db = get_db()\n    db.execute('INSERT INTO todos (title, created_at) VALUES (?, ?)',\n               (data['title'], datetime.now().isoformat()))\n    db.commit()\n    return jsonify({'message': '创建成功'}), 201\n\n@app.route('/api/todos/<int:todo_id>', methods=['PUT'])\ndef update_todo(todo_id):\n    data = request.get_json()\n    db = get_db()\n    db.execute('UPDATE todos SET done = ? WHERE id = ?',\n               (data.get('done', 0), todo_id))\n    db.commit()\n    return jsonify({'message': '更新成功'})\n\n@app.route('/api/todos/<int:todo_id>', methods=['DELETE'])\ndef delete_todo(todo_id):\n    db = get_db()\n    db.execute('DELETE FROM todos WHERE id = ?', (todo_id,))\n    db.commit()\n    return jsonify({'message': '删除成功'})\n\nif __name__ == '__main__':\n    app.run(debug=True)",
                "difficulty_level": "intermediate",
                "tags": ["Flask", "接口服务", "RESTful", "SQLite", "待办事项"],
            },
        ],
        "exercises": [
            {
                "title": "HTTP方法",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "在RESTful接口设计中，删除一个资源应该使用哪个HTTP方法？",
                "options": ["GET", "POST", "PUT", "DELETE"],
                "correct_answer": 3,
                "answer_analysis": "RESTful设计中，GET获取资源，POST创建资源，PUT更新资源，DELETE删除资源。",
                "hints": ["每种HTTP方法对应什么操作？", "RESTful设计原则"],
                "knowledge_tags": ["HTTP方法", "RESTful", "接口设计"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "数据库操作",
                "exercise_type": "choice",
                "difficulty_level": "intermediate",
                "content": "以下关于SQLite操作的描述，哪个是正确的？",
                "options": ["execute()方法执行查询后自动提交事务", "使用字符串拼接构建SQL语句是安全的做法", "fetchall()返回查询结果的所有行", "关闭连接后仍可执行查询操作"],
                "correct_answer": 2,
                "answer_analysis": "fetchall()返回查询结果的所有行，每行为一个元组。选项A错误，需手动commit()；选项B错误，应使用参数化查询防止SQL注入；选项D错误，关闭连接后不能执行查询。",
                "hints": ["事务提交需要什么操作？", "如何防止SQL注入？"],
                "knowledge_tags": ["数据库", "SQLite", "SQL注入", "参数化查询"],
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "接口开发编程",
                "exercise_type": "short_answer",
                "difficulty_level": "intermediate",
                "content": "请使用Flask编写一个简单的接口，实现GET /api/hello返回JSON格式的{\"message\": \"你好，世界\"}。",
                "correct_answer": "from flask import Flask, jsonify\n\napp = Flask(__name__)\n\n@app.route('/api/hello', methods=['GET'])\ndef hello():\n    return jsonify({'message': '你好，世界'})\n\nif __name__ == '__main__':\n    app.run(debug=True)",
                "answer_analysis": "使用Flask的jsonify()函数返回JSON格式的响应。@app.route()装饰器定义路由和请求方法。",
                "hints": ["使用jsonify()返回JSON响应", "@app.route()定义路由"],
                "knowledge_tags": ["Flask", "接口开发", "JSON", "路由"],
                "score": 10.0,
                "estimated_minutes": 8,
            },
        ],
    }
    chapters.append(ch8)

    return chapters


# 构建章节数据
PYTHON_COURSE_DATA["chapters"] = _build_chapters()


def seed_python_course():
    with app.app_context():
        existing = Course.query.filter_by(title=PYTHON_COURSE_DATA['course']['title']).first()
        if existing:
            print(f"[Seed] 课程'{PYTHON_COURSE_DATA['course']['title']}'已存在 (ID={existing.id})，跳过创建")
            course_id = existing.id
        else:
            teacher = User.query.filter_by(role='teacher').first()
            if not teacher:
                teacher = User.query.filter_by(role='admin').first()
            if not teacher:
                print("[Seed] 错误：找不到教师用户，请先创建教师账户")
                return
            course_data = PYTHON_COURSE_DATA['course']
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
            s_data = PYTHON_COURSE_DATA['syllabus']
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

        for ch_data in PYTHON_COURSE_DATA['chapters']:
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
                    examples=json.dumps(kp_data.get('examples', []), ensure_ascii=False),
                    formulas=json.dumps(kp_data.get('formulas', []), ensure_ascii=False),
                    tags=json.dumps(kp_data.get('tags', []), ensure_ascii=False),
                    prerequisites=json.dumps(kp_data.get('prerequisites', []), ensure_ascii=False),
                    related_concepts=json.dumps(kp_data.get('related_concepts', []), ensure_ascii=False),
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
        print(f"[Seed] 课程: {PYTHON_COURSE_DATA['course']['title']}")
        print(f"[Seed] 章节: {len(chapter_id_map)} 个")
        print(f"[Seed] 知识点: {total_kps} 个")
        print(f"[Seed] 教学案例: {total_cases} 个")
        print(f"[Seed] 习题: {total_exercises} 个")
        print(f"[Seed] ======================================")


if __name__ == '__main__':
    seed_python_course()
