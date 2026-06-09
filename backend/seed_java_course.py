import os
import sys
import json

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.models.user import db, User
from src.models.course import Course
from src.models.knowledge_base import CourseSyllabus, CourseChapter, KnowledgePoint, TeachingCase, CourseExercise
from src.main import app


JAVA_COURSE_DATA = {
    "course": {
        "title": "Java实战开发",
        "description": "本课程系统讲解Java语言的核心语法、面向对象编程思想、集合框架、输入输出处理、多线程并发编程、数据库操作与持久层框架、Spring框架核心技术、中间件与分布式技术以及微服务架构与部署。课程注重理论与实践结合，通过丰富的教学案例和项目实战，培养学生运用Java技术栈进行企业级应用开发的能力。",
        "category": "programming",
        "difficulty": "intermediate",
        "duration": "80学时",
        "status": "active",
    },
    "syllabus": {
        "course_code": "CS2201",
        "credit": 5.0,
        "total_hours": 80,
        "theory_hours": 40,
        "practice_hours": 40,
        "semester": "春季学期",
        "prerequisite_courses": ["计算机导论", "数据结构", "操作系统", "数据库原理"],
        "course_objectives": [
            "掌握Java面向对象编程的核心思想，能够熟练运用封装、继承、多态进行程序设计",
            "掌握集合框架的体系结构与泛型编程，能够根据场景选择合适的数据结构",
            "掌握多线程与并发编程技术，能够编写线程安全的高并发程序",
            "掌握数据库操作与持久层框架，能够实现高效的数据持久化与查询",
            "掌握Spring框架核心原理，能够使用Spring Boot快速构建企业级应用",
            "掌握微服务架构设计方法，能够进行服务的拆分、治理与容器化部署",
        ],
        "assessment_methods": {
            "平时作业": 15,
            "实验报告": 25,
            "课程项目": 30,
            "期末考试": 30,
        },
        "textbook": {
            "title": "Java核心技术（第12版）",
            "author": "凯·霍斯特曼",
            "publisher": "机械工业出版社",
            "year": 2022,
            "isbn": "978-7-111-71482-0",
        },
        "references": [
            {"title": "Effective Java（第3版）", "author": "约书亚·布洛克", "publisher": "机械工业出版社", "year": 2019},
            {"title": "Java编程思想（第4版）", "author": "布鲁斯·埃克尔", "publisher": "机械工业出版社", "year": 2007},
            {"title": "春季实战（第6版）", "author": "克雷格·沃斯", "publisher": "人民邮电出版社", "year": 2022},
            {"title": "深入理解Java虚拟机（第3版）", "author": "周志明", "publisher": "机械工业出版社", "year": 2019},
        ],
        "description": "Java实战开发是软件工程专业的核心课程，本课程旨在培养学生系统掌握Java语言及主流框架的开发技能，为后续企业级项目开发和职业发展奠定坚实基础。",
    },
    "chapters": [],
}


def _build_chapters():
    chapters = []

    # ===== 第1章 =====
    chapters.append({
        "title": "第1章 Java核心语法与面向对象",
        "order_index": 1,
        "teaching_hours": 12,
        "chapter_type": "theory",
        "description": "介绍Java开发环境搭建、基本语法、面向对象编程基础以及抽象类与接口的使用。",
        "objectives": ["掌握Java开发环境配置与项目结构", "理解基本数据类型与运算规则", "掌握面向对象编程的封装、继承与多态", "理解抽象类与接口的设计与应用"],
        "key_points": ["面向对象三大特性", "抽象类与接口", "方法重载与重写", "访问修饰符"],
        "difficulties": ["多态的运行时绑定机制", "抽象类与接口的选择", "内部类与匿名类"],
        "teaching_methods": ["讲授", "案例分析", "编程实验"],
        "knowledge_points": [
            {
                "title": "开发环境与项目结构",
                "order_index": 1,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "Java开发环境包括开发工具包、构建工具和集成开发环境，项目结构遵循特定的目录规范，是进行Java开发的基础设施。",
                "content": "Java开发需要安装开发工具包（JDK），配置环境变量JAVA_HOME和PATH。主流的集成开发环境包括IntelliJ IDEA和Eclipse，构建工具常用Maven和Gradle。\n\nMaven项目遵循标准目录结构：src/main/java存放源代码，src/main/resources存放资源文件，src/test/java存放测试代码。pom.xml文件定义项目依赖和构建配置。\n\nGradle使用build.gradle作为构建脚本，相比Maven更加灵活，支持Groovy或Kotlin DSL编写构建逻辑。现代Java项目越来越多地采用Gradle作为构建工具。\n\n理解包（package）的组织方式对于项目管理至关重要，通常采用域名反转的命名规范，如com.example.project，便于避免命名冲突和模块化管理。",
                "examples": json.dumps([{"title": "Maven项目pom.xml基本配置", "code": "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<project xmlns=\"http://maven.apache.org/POM/4.0.0\">\n    <modelVersion>4.0.0</modelVersion>\n    <groupId>com.example</groupId>\n    <artifactId>java-demo</artifactId>\n    <version>1.0-SNAPSHOT</version>\n    <properties>\n        <maven.compiler.source>17</maven.compiler.source>\n        <maven.compiler.target>17</maven.compiler.target>\n    </properties>\n</project>"}], ensure_ascii=False),
                "tags": json.dumps(["开发环境", "项目结构", "Maven", "Gradle"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps([], ensure_ascii=False),
                "related_concepts": json.dumps(["构建工具", "依赖管理", "版本控制"], ensure_ascii=False),
            },
            {
                "title": "基本数据类型与运算",
                "order_index": 2,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "Java语言定义了八种基本数据类型和丰富的运算符，是程序处理数据的基础。基本类型包括整型、浮点型、字符型和布尔型。",
                "content": "Java的八种基本数据类型分为四类：整型（byte、short、int、long）、浮点型（float、double）、字符型（char）和布尔型（boolean）。int是最常用的整数类型，占4个字节；double是默认的浮点类型，占8个字节。\n\n类型转换分为自动类型转换和强制类型转换。自动类型转换从低精度到高精度，如int到long；强制类型转换从高精度到低精度，可能丢失精度，如double到int。\n\n运算符包括算术运算符、关系运算符、逻辑运算符、位运算符和赋值运算符。需要注意整数除法会截断小数部分，以及浮点数精度问题。\n\n字符串（String）虽然不是基本类型，但使用极为频繁。字符串不可变，每次修改都会产生新对象。StringBuilder适用于频繁修改字符串的场景，性能优于字符串拼接。",
                "examples": json.dumps([{"title": "基本数据类型与运算示例", "code": "public class DataTypeDemo {\n    public static void main(String[] args) {\n        int age = 25;\n        double salary = 8500.50;\n        boolean isStudent = true;\n        char grade = 'A';\n\n        int intValue = 100;\n        long longValue = intValue;\n        int narrowed = (int) 3.99;\n\n        StringBuilder sb = new StringBuilder(\"Java\");\n        sb.append(\"实战开发\");\n        System.out.println(sb.toString());\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["数据类型", "运算符", "类型转换", "字符串"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["开发环境与项目结构"], ensure_ascii=False),
                "related_concepts": json.dumps(["包装类", "自动装箱拆箱", "常量池"], ensure_ascii=False),
            },
            {
                "title": "面向对象基础",
                "order_index": 3,
                "difficulty_level": "intermediate",
                "importance": "core",
                "definition": "面向对象编程是Java的核心编程范式，通过封装、继承和多态三大特性来组织代码，实现高内聚低耦合的程序设计。",
                "content": "封装是将数据和操作数据的方法绑定在一起，并隐藏内部实现细节。通过访问修饰符（private、protected、public）控制外部对类成员的访问。良好的封装使得类的内部实现可以自由修改而不影响外部调用者。\n\n继承允许子类复用父类的属性和方法，并可以扩展或修改父类的行为。Java采用单继承机制，一个类只能继承一个直接父类，但可以通过接口实现多重继承的效果。\n\n多态是面向对象最核心的特性，分为编译时多态（方法重载）和运行时多态（方法重写）。运行时多态通过父类引用指向子类对象实现，方法调用在运行时根据实际对象类型决定。\n\n设计原则推荐面向接口编程而非面向实现编程，优先使用组合而非继承，这些原则有助于构建灵活可维护的系统。",
                "examples": json.dumps([{"title": "面向对象多态示例", "code": "abstract class Shape {\n    abstract double area();\n    abstract String name();\n}\n\nclass Circle extends Shape {\n    private double radius;\n    Circle(double radius) { this.radius = radius; }\n    double area() { return Math.PI * radius * radius; }\n    String name() { return \"圆形\"; }\n}\n\nclass Rectangle extends Shape {\n    private double width, height;\n    Rectangle(double w, double h) { width = w; height = h; }\n    double area() { return width * height; }\n    String name() { return \"矩形\"; }\n}\n\npublic class PolymorphismDemo {\n    static void printArea(Shape shape) {\n        System.out.println(shape.name() + \"面积: \" + String.format(\"%.2f\", shape.area()));\n    }\n    public static void main(String[] args) {\n        printArea(new Circle(5));\n        printArea(new Rectangle(4, 6));\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["面向对象", "封装", "继承", "多态"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["基本数据类型与运算"], ensure_ascii=False),
                "related_concepts": json.dumps(["设计模式", "里氏替换原则", "开闭原则"], ensure_ascii=False),
            },
            {
                "title": "抽象类与接口",
                "order_index": 4,
                "difficulty_level": "intermediate",
                "importance": "core",
                "definition": "抽象类是不能被实例化的类，可以包含抽象方法和具体方法；接口是纯抽象契约，定义了类必须实现的方法规范。两者都是实现多态和代码复用的重要机制。",
                "content": "抽象类使用abstract关键字修饰，可以包含抽象方法（无方法体）和具体方法（有方法体）。抽象类适用于有共同属性和行为的类族，子类必须实现所有抽象方法。\n\n接口使用interface关键字定义，Java8引入了默认方法（default）和静态方法，Java9引入了私有方法，使得接口具有了更强的表达能力。一个类可以实现多个接口。\n\n选择抽象类还是接口的原则：如果多个类有共同的属性和行为，且存在is-a关系，使用抽象类；如果只是定义行为规范，不涉及共同状态，使用接口。\n\n函数式接口是只包含一个抽象方法的接口，可以使用Lambda表达式创建其实现，是Java函数式编程的基础。",
                "examples": json.dumps([{"title": "抽象类与接口综合示例", "code": "interface Flyable {\n    void fly();\n    default void land() { System.out.println(\"安全着陆\"); }\n}\n\ninterface Swimmable {\n    void swim();\n}\n\nabstract class Animal {\n    private String name;\n    Animal(String name) { this.name = name; }\n    String getName() { return name; }\n    abstract void speak();\n}\n\nclass Duck extends Animal implements Flyable, Swimmable {\n    Duck() { super(\"鸭子\"); }\n    void speak() { System.out.println(getName() + \": 嘎嘎\"); }\n    public void fly() { System.out.println(getName() + \"在飞翔\"); }\n    public void swim() { System.out.println(getName() + \"在游泳\"); }\n}\n\npublic class AbstractDemo {\n    public static void main(String[] args) {\n        Duck duck = new Duck();\n        duck.speak(); duck.fly(); duck.swim(); duck.land();\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["抽象类", "接口", "函数式接口", "默认方法"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["面向对象基础"], ensure_ascii=False),
                "related_concepts": json.dumps(["Lambda表达式", "设计模式", "策略模式"], ensure_ascii=False),
            },
        ],
        "teaching_cases": [
            {
                "title": "员工管理系统",
                "case_type": "application",
                "background": "某公司需要开发一个员工管理系统，用于管理不同类型的员工信息，包括正式员工和合同工。系统需要计算薪资、展示员工信息，并支持员工类型的扩展。",
                "problem_description": "设计一个基于面向对象的员工管理系统，支持不同类型员工的薪资计算和信息展示，要求具有良好的扩展性，新增员工类型时无需修改已有代码。",
                "analysis": "1. 抽取公共属性和行为到抽象基类Employee中\n2. 不同类型员工继承基类并实现各自的薪资计算逻辑\n3. 使用多态统一处理不同类型的员工\n4. 使用接口定义可扩展的行为规范",
                "solution": "1. 定义抽象类Employee，包含姓名、工号等公共属性和抽象方法calculateSalary\n2. 创建FullTimeEmployee和ContractEmployee子类，实现各自的薪资计算\n3. 使用Employee引用统一管理所有员工",
                "conclusion": "通过面向对象设计，系统实现了对各类员工的统一管理和差异化处理。抽象类封装了公共逻辑，接口提供了行为扩展能力，多态使得新增员工类型无需修改管理代码，体现了开闭原则。",
                "code_example": "import java.util.ArrayList;\nimport java.util.List;\n\nabstract class Employee {\n    protected String name;\n    protected String id;\n    Employee(String name, String id) { this.name = name; this.id = id; }\n    abstract double calculateSalary();\n    String getInfo() {\n        return String.format(\"工号:%s 姓名:%s 薪资:%.2f\", id, name, calculateSalary());\n    }\n}\n\nclass FullTimeEmployee extends Employee {\n    private double baseSalary;\n    private double bonus;\n    FullTimeEmployee(String name, String id, double baseSalary, double bonus) {\n        super(name, id); this.baseSalary = baseSalary; this.bonus = bonus;\n    }\n    double calculateSalary() { return baseSalary + bonus; }\n}\n\nclass ContractEmployee extends Employee {\n    private double hourlyRate;\n    private int hoursWorked;\n    ContractEmployee(String name, String id, double hourlyRate, int hoursWorked) {\n        super(name, id); this.hourlyRate = hourlyRate; this.hoursWorked = hoursWorked;\n    }\n    double calculateSalary() { return hourlyRate * hoursWorked; }\n}\n\npublic class EmployeeSystem {\n    public static void main(String[] args) {\n        List<Employee> employees = new ArrayList<>();\n        employees.add(new FullTimeEmployee(\"张三\", \"FT001\", 12000, 3000));\n        employees.add(new ContractEmployee(\"李四\", \"CT001\", 200, 80));\n        for (Employee e : employees) { System.out.println(e.getInfo()); }\n    }\n}",
                "difficulty_level": "intermediate",
                "tags": json.dumps(["面向对象", "多态", "抽象类", "员工管理"], ensure_ascii=False),
            },
        ],
        "exercises": [
            {
                "title": "面向对象基本概念",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "以下关于Java面向对象的描述，哪个是正确的？",
                "options": json.dumps(["Java支持多重继承，一个类可以继承多个类", "封装就是将所有成员变量设为public", "多态允许父类引用指向子类对象并调用子类重写的方法", "抽象类可以被直接实例化"], ensure_ascii=False),
                "correct_answer": 2,
                "answer_analysis": "Java是单继承的，选项A错误。封装通常将字段设为private，选项B错误。多态的核心就是父类引用指向子类对象，选项C正确。抽象类不能被实例化，选项D错误。",
                "hints": json.dumps(["思考Java的继承机制", "回忆多态的定义"], ensure_ascii=False),
                "knowledge_tags": json.dumps(["面向对象", "多态", "继承", "封装"], ensure_ascii=False),
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "抽象类与接口区别",
                "exercise_type": "choice",
                "difficulty_level": "intermediate",
                "content": "以下关于抽象类和接口的说法，哪个是错误的？",
                "options": json.dumps(["一个类可以实现多个接口，但只能继承一个抽象类", "抽象类可以有构造方法，接口不能有构造方法", "接口中的方法默认是public abstract的", "抽象类和接口都可以被直接实例化"], ensure_ascii=False),
                "correct_answer": 3,
                "answer_analysis": "抽象类和接口都不能被直接实例化。抽象类需要子类继承并实现抽象方法后才能创建对象，接口需要实现类实现所有抽象方法后才能创建对象。选项D的说法是错误的。",
                "hints": json.dumps(["回忆抽象类和接口的实例化规则", "思考new关键字能否直接用于抽象类或接口"], ensure_ascii=False),
                "knowledge_tags": json.dumps(["抽象类", "接口", "实例化"], ensure_ascii=False),
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "设计员工类层次结构",
                "exercise_type": "coding",
                "difficulty_level": "intermediate",
                "content": "请设计一个员工类层次结构：定义抽象类Employee，包含name属性和抽象方法getRole；定义Manager子类，增加department属性，实现getRole返回\"经理\"；定义Developer子类，增加language属性，实现getRole返回\"开发工程师\"。在主方法中创建对象并调用getRole方法展示多态效果。",
                "correct_answer": "abstract class Employee {\n    protected String name;\n    Employee(String name) { this.name = name; }\n    abstract String getRole();\n}\n\nclass Manager extends Employee {\n    private String department;\n    Manager(String name, String department) { super(name); this.department = department; }\n    String getRole() { return \"经理\"; }\n}\n\nclass Developer extends Employee {\n    private String language;\n    Developer(String name, String language) { super(name); this.language = language; }\n    String getRole() { return \"开发工程师\"; }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        Employee[] employees = { new Manager(\"王经理\", \"技术部\"), new Developer(\"张开发\", \"Java\") };\n        for (Employee e : employees) { System.out.println(e.name + \" - \" + e.getRole()); }\n    }\n}",
                "answer_analysis": "本题考察抽象类的定义与使用、继承关系的建立、多态的应用。关键点：抽象类定义公共属性和抽象方法，子类继承并实现抽象方法，通过父类引用数组统一管理不同子类对象，体现多态。",
                "hints": json.dumps(["先定义抽象类Employee", "子类继承并实现抽象方法", "使用父类引用数组展示多态"], ensure_ascii=False),
                "knowledge_tags": json.dumps(["抽象类", "继承", "多态", "类设计"], ensure_ascii=False),
                "score": 15.0,
                "estimated_minutes": 15,
            },
        ],
    })

    # ===== 第2章 =====
    chapters.append({
        "title": "第2章 集合框架与泛型",
        "order_index": 2,
        "teaching_hours": 10,
        "chapter_type": "theory",
        "description": "介绍Java集合框架的体系结构、列表与集、映射的使用，以及泛型编程与类型安全。",
        "objectives": ["理解集合框架的整体体系结构", "掌握列表、集、映射的使用场景与性能特点", "理解泛型的作用与类型擦除机制", "能够根据场景选择合适的集合类型"],
        "key_points": ["集合体系结构", "列表与集的区别", "映射的使用", "泛型与类型安全"],
        "difficulties": ["HashMap底层实现原理", "泛型类型擦除", "并发集合"],
        "teaching_methods": ["讲授", "案例分析", "编程实验"],
        "knowledge_points": [
            {
                "title": "集合体系结构",
                "order_index": 1,
                "difficulty_level": "beginner",
                "importance": "core",
                "definition": "Java集合框架是一套统一的数据结构体系，包含Collection和Map两大根接口，提供了存储和操作对象组的标准化方法。",
                "content": "集合框架的核心接口层次：Collection接口是单值集合的根接口，下分为List、Set和Queue三个子接口。List是有序可重复集合，Set是无序不可重复集合，Queue是先进先出队列。Map接口是键值对集合的根接口，与Collection并列。\n\n每种接口都有多个实现类，选择时需考虑：是否允许重复元素、是否保持插入顺序、是否需要排序、线程安全需求、读写性能等。\n\n迭代器（Iterator）是遍历集合的统一方式，提供了hasNext和next方法。增强for循环底层也使用迭代器实现。\n\nJava8引入的Stream API提供了函数式风格的集合操作，支持链式调用进行过滤、映射、归约等操作，使集合处理代码更加简洁高效。",
                "examples": json.dumps([{"title": "集合框架基本使用", "code": "import java.util.*;\n\npublic class CollectionDemo {\n    public static void main(String[] args) {\n        List<String> list = new ArrayList<>();\n        list.add(\"Java\"); list.add(\"Spring框架\"); list.add(\"微服务\");\n\n        Set<Integer> set = new HashSet<>(Arrays.asList(3, 1, 4, 1, 5));\n        System.out.println(\"集: \" + set);\n\n        Map<String, Integer> scores = new HashMap<>();\n        scores.put(\"张三\", 95); scores.put(\"李四\", 88);\n        scores.forEach((name, score) -> System.out.println(name + \": \" + score));\n\n        list.stream().filter(s -> s.length() > 2).forEach(System.out::println);\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["集合框架", "迭代器", "Stream", "数据结构"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["面向对象基础"], ensure_ascii=False),
                "related_concepts": json.dumps(["迭代器模式", "比较器", "线程安全集合"], ensure_ascii=False),
            },
            {
                "title": "列表与集",
                "order_index": 2,
                "difficulty_level": "intermediate",
                "importance": "core",
                "definition": "列表是有序可重复的集合，支持按索引访问；集是无序不可重复的集合，用于存储唯一元素。两者是日常开发中最常用的集合类型。",
                "content": "ArrayList基于动态数组实现，随机访问时间复杂度为O(1)，在中间插入删除为O(n)。默认初始容量为10，扩容为原来的1.5倍。适合读多写少的场景。\n\nLinkedList基于双向链表实现，在任意位置插入删除时间复杂度为O(1)（已定位节点），但随机访问为O(n)。\n\nHashSet基于HashMap实现，添加、删除、查找操作平均时间复杂度为O(1)。不保证元素顺序。\n\nTreeSet基于TreeMap实现，元素按自然顺序或指定比较器排序。添加、删除、查找操作时间复杂度为O(log n)。\n\nLinkedHashSet在HashSet基础上维护了插入顺序的链表，迭代时按插入顺序返回元素。",
                "examples": json.dumps([{"title": "列表与集的选择与使用", "code": "import java.util.*;\n\npublic class ListSetDemo {\n    public static void main(String[] args) {\n        List<String> items = Arrays.asList(\"苹果\", \"香蕉\", \"苹果\", \"橙子\", \"香蕉\");\n        List<String> unique = new ArrayList<>(new LinkedHashSet<>(items));\n        System.out.println(\"去重结果: \" + unique);\n\n        Set<Integer> sorted = new TreeSet<>(Arrays.asList(5, 2, 8, 1, 9));\n        System.out.println(\"排序集: \" + sorted);\n\n        List<String> fruits = new ArrayList<>(items);\n        fruits.sort(Comparator.comparingInt(String::length));\n        System.out.println(\"按长度排序: \" + fruits);\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["列表", "集", "ArrayList", "HashSet", "TreeSet"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["集合体系结构"], ensure_ascii=False),
                "related_concepts": json.dumps(["哈希表", "红黑树", "比较器"], ensure_ascii=False),
            },
            {
                "title": "映射",
                "order_index": 3,
                "difficulty_level": "intermediate",
                "importance": "core",
                "definition": "映射是键值对集合，每个键映射到一个值，键不可重复。映射是日常开发中处理关联数据的核心数据结构。",
                "content": "HashMap是最常用的映射实现，基于哈希表+红黑树结构（Java8优化）。当链表长度超过8时转换为红黑树，查找效率从O(n)提升到O(log n)。默认初始容量16，负载因子0.75。\n\nTreeMap基于红黑树实现，键按自然顺序或指定比较器排序。提供firstKey、lastKey、subMap等导航方法。\n\nLinkedHashMap在HashMap基础上维护了双向链表，可按插入顺序或访问顺序迭代。按访问顺序排序时可用于实现LRU缓存。\n\nConcurrentHashMap是线程安全的映射实现，采用CAS+同步（Java8）保证并发安全，性能远优于Hashtable。\n\n映射的遍历方式：keySet遍历键、values遍历值、entrySet遍历键值对。推荐使用entrySet。",
                "examples": json.dumps([{"title": "映射的使用与LRU缓存", "code": "import java.util.*;\n\nclass LRUCache<K, V> extends LinkedHashMap<K, V> {\n    private final int capacity;\n    LRUCache(int capacity) { super(capacity, 0.75f, true); this.capacity = capacity; }\n    @Override\n    protected boolean removeEldestEntry(Map.Entry<K, V> eldest) { return size() > capacity; }\n}\n\npublic class MapDemo {\n    public static void main(String[] args) {\n        Map<String, Integer> wordCount = new HashMap<>();\n        String[] words = {\"Java\", \"Spring框架\", \"Java\", \"微服务\", \"Java\"};\n        for (String word : words) { wordCount.merge(word, 1, Integer::sum); }\n        wordCount.forEach((k, v) -> System.out.println(k + \": \" + v));\n\n        LRUCache<String, String> cache = new LRUCache<>(3);\n        cache.put(\"A\", \"数据A\"); cache.put(\"B\", \"数据B\"); cache.put(\"C\", \"数据C\");\n        cache.get(\"A\"); cache.put(\"D\", \"数据D\");\n        System.out.println(\"缓存内容: \" + cache.keySet());\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["映射", "HashMap", "TreeMap", "LRU缓存"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["列表与集"], ensure_ascii=False),
                "related_concepts": json.dumps(["哈希函数", "负载因子", "并发映射"], ensure_ascii=False),
            },
            {
                "title": "泛型与类型安全",
                "order_index": 4,
                "difficulty_level": "advanced",
                "importance": "core",
                "definition": "泛型是Java的类型参数化机制，允许在定义类、接口和方法时使用类型参数，在编译时进行类型检查，消除运行时类型转换的风险。",
                "content": "泛型的核心价值是编译时类型安全。没有泛型时，集合存储Object类型，取值时需要强制转换，容易引发ClassCastException。\n\n类型擦除是Java泛型的实现机制。编译后泛型信息被擦除，类型参数替换为Object或上界类型。运行时无法获取泛型的具体类型信息。\n\n通配符提供了泛型的灵活性：?表示未知类型，? extends T表示上界通配符（用于读取），? super T表示下界通配符（用于写入）。PECS原则：生产者用extends，消费者用super。\n\n泛型方法允许在方法级别定义类型参数，不依赖于类级别的类型参数。类型推断使得调用泛型方法时通常不需要显式指定类型参数。",
                "examples": json.dumps([{"title": "泛型类与泛型方法", "code": "import java.util.*;\n\nclass Box<T> {\n    private T value;\n    void set(T value) { this.value = value; }\n    T get() { return value; }\n}\n\nclass Utils {\n    static <T> List<T> filter(List<T> list, Predicate<T> predicate) {\n        List<T> result = new ArrayList<>();\n        for (T item : list) { if (predicate.test(item)) result.add(item); }\n        return result;\n    }\n    static double sum(List<? extends Number> numbers) {\n        double total = 0;\n        for (Number n : numbers) total += n.doubleValue();\n        return total;\n    }\n}\n\n@FunctionalInterface\ninterface Predicate<T> { boolean test(T t); }\n\npublic class GenericDemo {\n    public static void main(String[] args) {\n        Box<String> box = new Box<>();\n        box.set(\"Java泛型\");\n        System.out.println(box.get());\n        List<Integer> nums = Arrays.asList(1, 2, 3, 4, 5);\n        List<Integer> evens = Utils.filter(nums, n -> n % 2 == 0);\n        System.out.println(\"偶数: \" + evens);\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["泛型", "类型安全", "类型擦除", "通配符"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["集合体系结构"], ensure_ascii=False),
                "related_concepts": json.dumps(["类型推断", "PECS原则", "反射与泛型"], ensure_ascii=False),
            },
        ],
        "teaching_cases": [
            {
                "title": "商品库存管理系统",
                "case_type": "application",
                "background": "某电商仓库需要开发商品库存管理系统，支持商品的入库、出库、查询和统计功能。商品按类别分组，需要快速查找和排序。",
                "problem_description": "使用集合框架实现商品库存管理，支持按编号查找商品、按类别分组、按价格排序、库存预警等功能。",
                "analysis": "1. 商品编号唯一，使用映射存储商品\n2. 商品按类别分组，使用映射的值为列表\n3. 排序功能使用比较器\n4. 库存预警使用过滤操作",
                "solution": "1. 定义Product类，包含编号、名称、类别、价格、库存量等属性\n2. 使用HashMap存储商品，实现快速查找\n3. 使用Stream API实现分组、排序和过滤",
                "conclusion": "集合框架为商品管理提供了高效的数据结构和丰富的操作方法。映射实现了快速查找，Stream API简化了分组统计，泛型保证了类型安全。",
                "code_example": "import java.util.*;\nimport java.util.stream.*;\n\nclass Product {\n    String id, name, category;\n    double price;\n    int stock;\n    Product(String id, String name, String category, double price, int stock) {\n        this.id = id; this.name = name; this.category = category;\n        this.price = price; this.stock = stock;\n    }\n    public String toString() {\n        return String.format(\"%s(%s) 价格:%.2f 库存:%d\", name, category, price, stock);\n    }\n}\n\npublic class InventorySystem {\n    private Map<String, Product> products = new HashMap<>();\n    void addProduct(Product p) { products.put(p.id, p); }\n    Product findById(String id) { return products.get(id); }\n    Map<String, List<Product>> groupByCategory() {\n        return products.values().stream().collect(Collectors.groupingBy(p -> p.category));\n    }\n    List<Product> lowStockAlert(int threshold) {\n        return products.values().stream().filter(p -> p.stock < threshold).collect(Collectors.toList());\n    }\n    List<Product> sortByPrice() {\n        return products.values().stream().sorted(Comparator.comparingDouble(p -> p.price)).collect(Collectors.toList());\n    }\n    public static void main(String[] args) {\n        InventorySystem inv = new InventorySystem();\n        inv.addProduct(new Product(\"P01\", \"键盘\", \"外设\", 299, 50));\n        inv.addProduct(new Product(\"P02\", \"显示器\", \"外设\", 1999, 5));\n        inv.addProduct(new Product(\"P03\", \"内存条\", \"配件\", 399, 3));\n        System.out.println(\"库存预警: \" + inv.lowStockAlert(10));\n        System.out.println(\"按类别分组: \" + inv.groupByCategory());\n    }\n}",
                "difficulty_level": "intermediate",
                "tags": json.dumps(["集合框架", "映射", "Stream", "库存管理"], ensure_ascii=False),
            },
        ],
        "exercises": [
            {
                "title": "集合类型选择",
                "exercise_type": "choice",
                "difficulty_level": "beginner",
                "content": "需要存储学生成绩并按分数从高到低排序展示，最合适的集合类型是：",
                "options": json.dumps(["HashSet", "ArrayList", "TreeSet", "LinkedList"], ensure_ascii=False),
                "correct_answer": 2,
                "answer_analysis": "TreeSet基于红黑树实现，元素自动排序，适合需要排序的场景。HashSet不保证顺序，ArrayList和LinkedList需要手动排序。",
                "hints": json.dumps(["思考哪种集合自带排序功能", "考虑自动排序的需求"], ensure_ascii=False),
                "knowledge_tags": json.dumps(["集合选择", "TreeSet", "排序"], ensure_ascii=False),
                "score": 5.0,
                "estimated_minutes": 3,
            },
            {
                "title": "HashMap底层原理",
                "exercise_type": "short_answer",
                "difficulty_level": "advanced",
                "content": "请简述Java8中HashMap的底层实现原理，包括哈希冲突的解决方式和链表转红黑树的条件。",
                "correct_answer": "HashMap底层基于数组+链表+红黑树实现。计算key的哈希值后，通过(n-1)&hash确定桶位置。当多个key映射到同一桶时形成链表（拉链法解决哈希冲突）。当链表长度超过8且数组长度达到64时，链表转换为红黑树，查找效率从O(n)提升到O(log n)。当红黑树节点数减少到6时，退化回链表。扩容时容量翻倍，元素重新分配位置。",
                "answer_analysis": "理解HashMap底层实现对于正确使用HashMap和解决性能问题至关重要。链表转红黑树是Java8的重要优化。",
                "hints": json.dumps(["回忆拉链法的原理", "注意链表转红黑树的两个条件"], ensure_ascii=False),
                "knowledge_tags": json.dumps(["HashMap", "哈希冲突", "红黑树", "底层实现"], ensure_ascii=False),
                "score": 10.0,
                "estimated_minutes": 8,
            },
            {
                "title": "泛型集合操作",
                "exercise_type": "coding",
                "difficulty_level": "intermediate",
                "content": "请编写一个泛型工具类CollectionUtils，包含以下方法：1) frequency方法，统计列表中每个元素出现的次数，返回映射；2) merge方法，合并两个映射，相同键的值用传入的合并函数处理。在主方法中测试这两个方法。",
                "correct_answer": "import java.util.*;\nimport java.util.function.*;\n\nclass CollectionUtils {\n    static <T> Map<T, Integer> frequency(List<T> list) {\n        Map<T, Integer> result = new HashMap<>();\n        for (T item : list) { result.merge(item, 1, Integer::sum); }\n        return result;\n    }\n    static <K, V> Map<K, V> merge(Map<K, V> map1, Map<K, V> map2, BiFunction<V, V, V> mergeFunc) {\n        Map<K, V> result = new HashMap<>(map1);\n        map2.forEach((k, v) -> result.merge(k, v, mergeFunc));\n        return result;\n    }\n}\n\npublic class Main {\n    public static void main(String[] args) {\n        List<String> words = Arrays.asList(\"Java\", \"Spring框架\", \"Java\", \"微服务\");\n        System.out.println(\"词频: \" + CollectionUtils.frequency(words));\n        Map<String, Integer> m1 = Map.of(\"Java\", 90, \"Spring框架\", 85);\n        Map<String, Integer> m2 = Map.of(\"Java\", 88, \"微服务\", 92);\n        Map<String, Integer> merged = CollectionUtils.merge(m1, m2, (v1, v2) -> (v1 + v2) / 2);\n        System.out.println(\"合并: \" + merged);\n    }\n}",
                "answer_analysis": "本题考察泛型方法定义、映射的merge操作、函数式接口的使用。frequency方法利用Map.merge简化计数逻辑，merge方法使用BiFunction实现灵活的值合并策略。",
                "hints": json.dumps(["使用Map.merge方法简化代码", "合并函数使用BiFunction参数"], ensure_ascii=False),
                "knowledge_tags": json.dumps(["泛型", "映射操作", "函数式编程"], ensure_ascii=False),
                "score": 15.0,
                "estimated_minutes": 15,
            },
        ],
    })

    # ===== 第3章 =====
    chapters.append({
        "title": "第3章 输入输出与文件处理",
        "order_index": 3,
        "teaching_hours": 8,
        "chapter_type": "theory",
        "description": "介绍Java输入输出流体系、缓冲流与转换流、文件与目录操作以及序列化与反序列化技术。",
        "objectives": ["理解字节流与字符流的区别与使用", "掌握缓冲流和转换流提升读写效率", "掌握文件与目录的创建、查询和删除操作", "理解序列化机制与自定义序列化策略"],
        "key_points": ["字节流与字符流", "缓冲流", "文件操作", "序列化"],
        "difficulties": ["NIO非阻塞IO", "字符编码问题", "序列化版本号"],
        "teaching_methods": ["讲授", "案例分析", "编程实验"],
        "knowledge_points": [
            {
                "title": "字节流与字符流",
                "order_index": 1, "difficulty_level": "beginner", "importance": "core",
                "definition": "字节流以字节为单位读写数据，适合处理二进制文件；字符流以字符为单位读写数据，适合处理文本文件，自动处理字符编码转换。",
                "content": "字节流的基类是InputStream和OutputStream，常用实现包括FileInputStream、FileOutputStream。字符流的基类是Reader和Writer，常用实现包括FileReader、FileWriter。\n\n选择字节流还是字符流的原则：处理文本数据使用字符流，处理二进制数据使用字节流。\n\ntry-with-resources语句自动关闭资源，替代了传统的try-finally模式，是资源管理的最佳实践。",
                "examples": json.dumps([{"title": "字节流与字符流文件读写", "code": "import java.io.*;\n\npublic class StreamDemo {\n    static void copyFile(String src, String dest) throws IOException {\n        try (InputStream in = new FileInputStream(src); OutputStream out = new FileOutputStream(dest)) {\n            byte[] buffer = new byte[4096];\n            int bytesRead;\n            while ((bytesRead = in.read(buffer)) != -1) { out.write(buffer, 0, bytesRead); }\n        }\n    }\n    static String readText(String path) throws IOException {\n        try (BufferedReader reader = new BufferedReader(new FileReader(path, java.nio.charset.StandardCharsets.UTF_8))) {\n            StringBuilder sb = new StringBuilder();\n            String line;\n            while ((line = reader.readLine()) != null) { sb.append(line).append(\"\\n\"); }\n            return sb.toString();\n        }\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["字节流", "字符流", "文件读写", "编码"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["基本数据类型与运算"], ensure_ascii=False),
                "related_concepts": json.dumps(["NIO", "字符编码", "管道流"], ensure_ascii=False),
            },
            {
                "title": "缓冲流与转换流",
                "order_index": 2, "difficulty_level": "intermediate", "importance": "core",
                "definition": "缓冲流在基础流上添加缓冲区，减少实际IO操作次数，显著提升读写性能；转换流实现字节流与字符流之间的转换，可指定字符编码。",
                "content": "BufferedInputStream和BufferedOutputStream为字节流提供缓冲功能，默认缓冲区大小8192字节。BufferedReader和BufferedWriter为字符流提供缓冲功能，readLine方法可逐行读取文本。\n\nInputStreamReader是将字节流转换为字符流的桥梁，可指定字符编码。OutputStreamWriter是将字符流转换为字节流的桥梁。",
                "examples": json.dumps([{"title": "缓冲流与转换流使用", "code": "import java.io.*;\nimport java.nio.charset.StandardCharsets;\n\npublic class BufferedStreamDemo {\n    static void writeWithBuffer(String path, String content) throws IOException {\n        try (BufferedWriter writer = new BufferedWriter(new OutputStreamWriter(new FileOutputStream(path), StandardCharsets.UTF_8))) {\n            writer.write(content); writer.newLine(); writer.flush();\n        }\n    }\n    static void readWithBuffer(String path) throws IOException {\n        try (BufferedReader reader = new BufferedReader(new InputStreamReader(new FileInputStream(path), StandardCharsets.UTF_8))) {\n            String line;\n            while ((line = reader.readLine()) != null) { System.out.println(line); }\n        }\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["缓冲流", "转换流", "字符编码", "性能优化"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["字节流与字符流"], ensure_ascii=False),
                "related_concepts": json.dumps(["NIO通道", "内存映射文件", "字符集"], ensure_ascii=False),
            },
            {
                "title": "文件与目录操作",
                "order_index": 3, "difficulty_level": "intermediate", "importance": "core",
                "definition": "Java提供了File类和NIO的Path、Files类来操作文件和目录，包括创建、删除、查询属性、遍历目录等操作。",
                "content": "Java7引入的NIO.2 API（Path和Files）是现代文件操作的首选。Path替代了File，提供了更丰富的路径操作方法。Files工具类提供了大量静态方法。\n\nFiles.walk方法递归遍历目录树，Files.lines方法返回Stream，支持惰性读取大文件。Files.readString和Files.writeString等便捷方法简化了小文件的读写。",
                "examples": json.dumps([{"title": "文件与目录操作", "code": "import java.nio.file.*;\nimport java.util.stream.*;\n\npublic class FileDemo {\n    public static void main(String[] args) throws Exception {\n        Path dir = Paths.get(\"demo_dir\");\n        Files.createDirectories(dir);\n        Path file = dir.resolve(\"hello.txt\");\n        Files.writeString(file, \"Java文件操作示例\");\n        String content = Files.readString(file);\n        System.out.println(\"文件内容: \" + content);\n        try (Stream<Path> paths = Files.walk(dir)) {\n            paths.filter(Files::isRegularFile).forEach(p -> System.out.println(p.getFileName()));\n        }\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["文件操作", "目录操作", "Path", "Files"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["字节流与字符流"], ensure_ascii=False),
                "related_concepts": json.dumps(["文件权限", "文件锁", "临时文件"], ensure_ascii=False),
            },
            {
                "title": "序列化与反序列化",
                "order_index": 4, "difficulty_level": "advanced", "importance": "core",
                "definition": "序列化是将对象转换为字节序列的过程，反序列化是将字节序列恢复为对象的过程。Java通过Serializable接口实现对象的序列化与反序列化。",
                "content": "实现Serializable接口的类可以被序列化。serialVersionUID用于标识类的版本。transient关键字修饰的字段不参与序列化。\n\nJava序列化存在安全风险，推荐使用JSON等文本格式进行数据交换。开发中应尽量避免使用Java原生序列化。",
                "examples": json.dumps([{"title": "对象序列化与反序列化", "code": "import java.io.*;\n\nclass Student implements Serializable {\n    private static final long serialVersionUID = 1L;\n    private String name;\n    private int age;\n    private transient String password;\n    Student(String name, int age, String password) { this.name = name; this.age = age; this.password = password; }\n    public String toString() {\n        return String.format(\"姓名:%s 年龄:%d 密码:%s\", name, age, password != null ? password : \"(未序列化)\");\n    }\n}\n\npublic class SerializeDemo {\n    public static void main(String[] args) throws Exception {\n        Student stu = new Student(\"张三\", 20, \"secret123\");\n        try (ObjectOutputStream oos = new ObjectOutputStream(new FileOutputStream(\"student.dat\"))) { oos.writeObject(stu); }\n        try (ObjectInputStream ois = new ObjectInputStream(new FileInputStream(\"student.dat\"))) {\n            Student restored = (Student) ois.readObject(); System.out.println(restored);\n        }\n    }\n}"}], ensure_ascii=False),
                "tags": json.dumps(["序列化", "反序列化", "transient", "serialVersionUID"], ensure_ascii=False),
                "formulas": json.dumps([], ensure_ascii=False),
                "prerequisites": json.dumps(["字节流与字符流", "面向对象基础"], ensure_ascii=False),
                "related_concepts": json.dumps(["JSON序列化", "Protocol Buffers", "安全漏洞"], ensure_ascii=False),
            },
        ],
        "teaching_cases": [
            {
                "title": "配置文件解析器",
                "case_type": "application",
                "background": "应用程序需要读取配置文件来初始化参数，配置文件采用键值对格式，支持注释和分组。",
                "problem_description": "实现一个配置文件解析器，支持读取键值对配置、注释忽略、分组管理、类型转换和配置修改后保存功能。",
                "analysis": "1. 配置文件格式：键=值，#开头为注释，[section]为分组\n2. 使用映射存储配置项\n3. 读取时逐行解析\n4. 提供类型安全的获取方法",
                "solution": "1. 定义ConfigParser类，使用Map存储配置\n2. 实现parse方法逐行解析\n3. 提供getString、getInt等类型安全方法\n4. 实现save方法写回文件",
                "conclusion": "配置文件解析器综合运用了字符流读取、字符串处理、映射存储和文件写入等IO技术。缓冲流提升了读取效率，try-with-resources确保了资源的正确释放。",
                "code_example": "import java.io.*;\nimport java.util.*;\n\nclass ConfigParser {\n    private Map<String, Map<String, String>> sections = new LinkedHashMap<>();\n    private String currentSection = \"default\";\n    void parse(String filePath) throws IOException {\n        try (BufferedReader reader = new BufferedReader(new FileReader(filePath))) {\n            String line;\n            while ((line = reader.readLine()) != null) {\n                line = line.trim();\n                if (line.isEmpty() || line.startsWith(\"#\")) continue;\n                if (line.startsWith(\"[\") && line.endsWith(\"]\")) {\n                    currentSection = line.substring(1, line.length() - 1);\n                    sections.putIfAbsent(currentSection, new LinkedHashMap<>());\n                } else if (line.contains(\"=\")) {\n                    String[] parts = line.split(\"=\", 2);\n                    sections.computeIfAbsent(currentSection, k -> new LinkedHashMap<>()).put(parts[0].trim(), parts[1].trim());\n                }\n            }\n        }\n    }\n    String getString(String section, String key, String defaultValue) {\n        return sections.getOrDefault(section, Map.of()).getOrDefault(key, defaultValue);\n    }\n    int getInt(String section, String key, int defaultValue) {\n        String val = getString(section, key, null);\n        return val != null ? Integer.parseInt(val) : defaultValue;\n    }\n}",
                "difficulty_level": "intermediate",
                "tags": json.dumps(["文件读写", "配置解析", "缓冲流", "字符串处理"], ensure_ascii=False),
            },
        ],
        "exercises": [
            {"title": "字节流与字符流选择", "exercise_type": "choice", "difficulty_level": "beginner", "content": "以下场景中，应该使用字符流而非字节流的是：", "options": json.dumps(["复制图片文件", "读取文本文件内容并统计词频", "下载网络视频", "读取压缩包文件"], ensure_ascii=False), "correct_answer": 1, "answer_analysis": "读取文本文件并统计词频需要按字符处理文本内容，字符流自动处理编码转换。图片、视频、压缩包都是二进制文件，必须使用字节流。", "hints": json.dumps(["区分文本文件和二进制文件", "字符流适合处理什么类型的数据"], ensure_ascii=False), "knowledge_tags": json.dumps(["字节流", "字符流", "文件类型"], ensure_ascii=False), "score": 5.0, "estimated_minutes": 3},
            {"title": "try-with-resources", "exercise_type": "choice", "difficulty_level": "intermediate", "content": "关于try-with-resources语句，以下说法错误的是：", "options": json.dumps(["资源必须实现AutoCloseable接口", "多个资源按声明顺序打开，按逆序关闭", "即使发生异常，资源也会被自动关闭", "try-with-resources不能与catch子句同时使用"], ensure_ascii=False), "correct_answer": 3, "answer_analysis": "try-with-resources可以与catch和finally子句同时使用。语法上完全兼容。选项D的说法是错误的。", "hints": json.dumps(["回忆try-with-resources的完整语法", "思考异常处理与资源管理的关系"], ensure_ascii=False), "knowledge_tags": json.dumps(["try-with-resources", "异常处理", "资源管理"], ensure_ascii=False), "score": 5.0, "estimated_minutes": 3},
            {"title": "实现文件内容搜索工具", "exercise_type": "coding", "difficulty_level": "intermediate", "content": "请编写一个文件内容搜索工具：1) 递归搜索指定目录下所有文本文件；2) 在文件内容中搜索包含指定关键词的行；3) 输出匹配的文件名、行号和行内容。使用NIO的Files和Path API。", "correct_answer": "import java.nio.file.*;\nimport java.util.*;\nimport java.util.stream.*;\n\nclass SearchResult {\n    String fileName; int lineNumber; String content;\n    SearchResult(String fileName, int lineNumber, String content) { this.fileName = fileName; this.lineNumber = lineNumber; this.content = content; }\n    public String toString() { return String.format(\"%s:%d - %s\", fileName, lineNumber, content.trim()); }\n}\n\nclass FileSearcher {\n    List<SearchResult> search(Path dir, String keyword) throws IOException {\n        List<SearchResult> results = new ArrayList<>();\n        try (Stream<Path> paths = Files.walk(dir)) {\n            paths.filter(Files::isRegularFile).filter(p -> p.toString().endsWith(\".txt\") || p.toString().endsWith(\".java\"))\n                 .forEach(p -> searchInFile(p, keyword, results));\n        }\n        return results;\n    }\n    private void searchInFile(Path file, String keyword, List<SearchResult> results) {\n        try (Stream<String> lines = Files.lines(file)) {\n            Iterator<String> iter = lines.iterator();\n            int lineNum = 0;\n            while (iter.hasNext()) { lineNum++; String line = iter.next(); if (line.contains(keyword)) results.add(new SearchResult(file.getFileName().toString(), lineNum, line)); }\n        } catch (IOException e) { System.err.println(\"无法读取: \" + file); }\n    }\n}", "answer_analysis": "本题考察NIO文件遍历、流式文件读取、异常处理等综合能力。Files.walk递归遍历目录，Files.lines惰性读取文件行。", "hints": json.dumps(["使用Files.walk递归遍历", "使用Files.lines逐行读取", "注意异常处理不要中断整体流程"], ensure_ascii=False), "knowledge_tags": json.dumps(["文件操作", "NIO", "流式处理", "异常处理"], ensure_ascii=False), "score": 15.0, "estimated_minutes": 15},
        ],
    })

    # ===== 第4章 =====
    chapters.append({
        "title": "第4章 多线程与并发编程",
        "order_index": 4, "teaching_hours": 10, "chapter_type": "theory",
        "description": "介绍线程创建与生命周期、同步机制与锁、线程池的使用以及并发工具类的应用。",
        "objectives": ["掌握线程的创建方式与生命周期管理", "理解同步机制与锁的原理和使用", "掌握线程池的配置与使用", "能够使用并发工具类解决常见并发问题"],
        "key_points": ["线程生命周期", "synchronized与Lock", "线程池", "并发工具类"],
        "difficulties": ["线程安全分析", "死锁的检测与避免", "并发工具类的原理"],
        "teaching_methods": ["讲授", "案例分析", "编程实验"],
        "knowledge_points": [
            {"title": "线程创建与生命周期", "order_index": 1, "difficulty_level": "beginner", "importance": "core", "definition": "线程是操作系统调度的最小单元，Java通过Thread类和Runnable接口提供线程支持。线程生命周期包括新建、就绪、运行、阻塞和终止五种状态。", "content": "创建线程有三种方式：继承Thread类、实现Runnable接口、实现Callable接口配合FutureTask获取返回值。推荐使用Runnable或Callable。\n\n线程生命周期状态：NEW→RUNNABLE→BLOCKED→WAITING→TIMED_WAITING→TERMINATED。\n\n守护线程是为用户线程提供服务的后台线程，当所有用户线程结束后自动销毁。线程的start方法只能调用一次。", "examples": json.dumps([{"title": "线程创建方式", "code": "import java.util.concurrent.*;\n\npublic class ThreadDemo {\n    public static void main(String[] args) throws Exception {\n        new Thread(() -> System.out.println(\"线程1运行\")).start();\n        Runnable task = () -> { for (int i = 0; i < 3; i++) System.out.println(Thread.currentThread().getName() + \": \" + i); };\n        new Thread(task, \"工作线程\").start();\n        Callable<Integer> callable = () -> { int sum = 0; for (int i = 1; i <= 100; i++) sum += i; return sum; };\n        FutureTask<Integer> future = new FutureTask<>(callable);\n        new Thread(future).start();\n        System.out.println(\"计算结果: \" + future.get());\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["线程创建", "生命周期", "Runnable", "Callable"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["面向对象基础"], ensure_ascii=False), "related_concepts": json.dumps(["进程与线程", "CPU调度", "上下文切换"], ensure_ascii=False)},
            {"title": "同步机制与锁", "order_index": 2, "difficulty_level": "advanced", "importance": "core", "definition": "同步机制是保证多线程安全访问共享资源的手段，Java提供了synchronized关键字和Lock接口两种主要的锁机制。", "content": "synchronized是Java内置的锁机制，可修饰方法或代码块。Lock接口提供了更灵活的锁操作，ReentrantLock支持公平锁、可中断锁获取、超时锁获取。\n\nReadWriteLock将锁分为读锁和写锁，适合读多写少的场景。\n\n死锁是两个或多个线程互相持有对方需要的资源而无限等待的现象。避免策略：按固定顺序获取锁、使用tryLock超时机制、减少锁粒度。", "examples": json.dumps([{"title": "同步机制使用", "code": "import java.util.concurrent.locks.*;\n\nclass Counter {\n    private int count = 0;\n    private final ReentrantLock lock = new ReentrantLock();\n    synchronized void syncIncrement() { count++; }\n    void lockIncrement() { lock.lock(); try { count++; } finally { lock.unlock(); } }\n    int getCount() { return count; }\n}\n\nclass Cache<K, V> {\n    private final Map<K, V> map = new HashMap<>();\n    private final ReadWriteLock rwLock = new ReentrantReadWriteLock();\n    V get(K key) { rwLock.readLock().lock(); try { return map.get(key); } finally { rwLock.readLock().unlock(); } }\n    void put(K key, V value) { rwLock.writeLock().lock(); try { map.put(key, value); } finally { rwLock.writeLock().unlock(); } }\n}"}], ensure_ascii=False), "tags": json.dumps(["同步", "锁", "synchronized", "ReentrantLock", "死锁"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["线程创建与生命周期"], ensure_ascii=False), "related_concepts": json.dumps(["乐观锁", "CAS", "AQS"], ensure_ascii=False)},
            {"title": "线程池", "order_index": 3, "difficulty_level": "intermediate", "importance": "core", "definition": "线程池是管理一组工作线程的容器，通过复用线程避免频繁创建销毁的开销，并提供任务队列和拒绝策略管理并发任务。", "content": "ThreadPoolExecutor是线程池的核心实现类，构造参数包括：核心线程数、最大线程数、空闲存活时间、工作队列、拒绝策略。\n\n四种拒绝策略：AbortPolicy（抛出异常）、CallerRunsPolicy（调用者执行）、DiscardPolicy（丢弃）、DiscardOldestPolicy（丢弃最老任务）。\n\n不推荐使用Executors快捷创建方法，因为无界队列可能导致内存溢出。Java8的ForkJoinPool支持分治并行计算。", "examples": json.dumps([{"title": "线程池使用", "code": "import java.util.concurrent.*;\n\npublic class ThreadPoolDemo {\n    public static void main(String[] args) {\n        ThreadPoolExecutor executor = new ThreadPoolExecutor(4, 8, 60L, TimeUnit.SECONDS,\n            new ArrayBlockingQueue<>(100), new ThreadPoolExecutor.CallerRunsPolicy());\n        for (int i = 0; i < 20; i++) {\n            final int taskId = i;\n            executor.submit(() -> { System.out.println(Thread.currentThread().getName() + \" 执行任务 \" + taskId); });\n        }\n        executor.shutdown();\n        try { executor.awaitTermination(30, TimeUnit.SECONDS); } catch (InterruptedException e) { executor.shutdownNow(); }\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["线程池", "ThreadPoolExecutor", "拒绝策略", "任务队列"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["线程创建与生命周期", "同步机制与锁"], ensure_ascii=False), "related_concepts": json.dumps(["ForkJoinPool", "CompletableFuture", "异步编程"], ensure_ascii=False)},
            {"title": "并发工具类", "order_index": 4, "difficulty_level": "advanced", "importance": "core", "definition": "Java并发包提供了一系列工具类来简化常见并发编程场景，包括同步辅助类、原子类和并发集合等。", "content": "CountDownLatch允许一个或多个线程等待其他线程完成操作。CyclicBarrier让一组线程互相等待到齐后再继续执行，可重用。Semaphore控制同时访问某资源的线程数量。\n\n原子类（AtomicInteger等）基于CAS实现无锁线程安全操作。并发集合包括ConcurrentHashMap、CopyOnWriteArrayList、BlockingQueue等。", "examples": json.dumps([{"title": "并发工具类综合使用", "code": "import java.util.concurrent.*;\nimport java.util.concurrent.atomic.*;\n\npublic class ConcurrentDemo {\n    public static void main(String[] args) throws Exception {\n        CountDownLatch latch = new CountDownLatch(3);\n        AtomicInteger counter = new AtomicInteger(0);\n        for (int i = 0; i < 3; i++) {\n            new Thread(() -> { counter.incrementAndGet(); latch.countDown(); }).start();\n        }\n        latch.await();\n        System.out.println(\"所有任务完成，计数: \" + counter.get());\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["CountDownLatch", "CyclicBarrier", "原子类", "并发集合"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["线程池", "同步机制与锁"], ensure_ascii=False), "related_concepts": json.dumps(["CAS原理", "ABA问题", "内存屏障"], ensure_ascii=False)},
        ],
        "teaching_cases": [
            {"title": "多线程文件下载器", "case_type": "application", "background": "大文件下载时，单线程下载速度受限。多线程下载通过将文件分为多个片段并行下载，可以显著提高下载速度。", "problem_description": "实现一个多线程文件下载器，支持将文件分成多个片段并行下载，显示下载进度，并在所有片段下载完成后合并文件。", "analysis": "1. 使用HTTP Range请求获取文件部分内容\n2. 线程池管理下载线程\n3. CountDownLatch等待所有片段下载完成\n4. RandomAccessFile实现多线程写入\n5. 原子类统计下载进度", "solution": "1. 获取文件总大小，计算每个片段的起止位置\n2. 创建线程池，每个线程负责下载一个片段\n3. 使用RandomAccessFile的seek方法定位写入位置\n4. CountDownLatch同步所有下载线程", "conclusion": "多线程下载器综合运用了线程池、同步辅助类、原子类和文件IO等技术。线程池管理并发下载，CountDownLatch协调线程完成，RandomAccessFile实现多线程安全写入。", "code_example": "import java.io.*;\nimport java.net.*;\nimport java.util.concurrent.*;\nimport java.util.concurrent.atomic.*;\n\nclass DownloadTask implements Callable<Boolean> {\n    private String url; private long start, end; private RandomAccessFile raf; private AtomicInteger progress;\n    DownloadTask(String url, long start, long end, RandomAccessFile raf, AtomicInteger progress) { this.url = url; this.start = start; this.end = end; this.raf = raf; this.progress = progress; }\n    public Boolean call() throws Exception {\n        HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();\n        conn.setRequestProperty(\"Range\", \"bytes=\" + start + \"-\" + end);\n        try (InputStream in = conn.getInputStream()) { raf.seek(start); byte[] buffer = new byte[8192]; int bytesRead; while ((bytesRead = in.read(buffer)) != -1) { raf.write(buffer, 0, bytesRead); progress.addAndGet(bytesRead); } }\n        return true;\n    }\n}\n\npublic class MultiThreadDownloader {\n    public static void main(String[] args) throws Exception {\n        String url = \"http://example.com/largefile.zip\";\n        long fileSize = 10 * 1024 * 1024; int threadCount = 4; long chunkSize = fileSize / threadCount;\n        RandomAccessFile raf = new RandomAccessFile(\"download.zip\", \"rw\"); raf.setLength(fileSize);\n        AtomicInteger progress = new AtomicInteger(0);\n        ExecutorService pool = Executors.newFixedThreadPool(threadCount);\n        List<Future<Boolean>> futures = new ArrayList<>();\n        for (int i = 0; i < threadCount; i++) { long start = i * chunkSize; long end = (i == threadCount - 1) ? fileSize - 1 : start + chunkSize - 1; futures.add(pool.submit(new DownloadTask(url, start, end, raf, progress))); }\n        for (Future<Boolean> f : futures) f.get(); raf.close(); pool.shutdown(); System.out.println(\"下载完成\");\n    }\n}", "difficulty_level": "advanced", "tags": json.dumps(["多线程", "线程池", "CountDownLatch", "文件下载"], ensure_ascii=False)},
        ],
        "exercises": [
            {"title": "线程安全判断", "exercise_type": "choice", "difficulty_level": "intermediate", "content": "以下哪种情况不需要同步？", "options": json.dumps(["多个线程修改同一个共享变量", "多个线程读取同一个共享变量", "多个线程修改同一个并发集合", "多个线程各自操作自己的局部变量"], ensure_ascii=False), "correct_answer": 3, "answer_analysis": "局部变量存储在线程栈中，每个线程有独立的副本，不存在共享问题，因此不需要同步。", "hints": json.dumps(["思考变量的存储位置", "区分共享变量和局部变量"], ensure_ascii=False), "knowledge_tags": json.dumps(["线程安全", "同步", "局部变量"], ensure_ascii=False), "score": 5.0, "estimated_minutes": 3},
            {"title": "线程池参数配置", "exercise_type": "short_answer", "difficulty_level": "advanced", "content": "请解释ThreadPoolExecutor的核心线程数、最大线程数和工作队列三者之间的关系，以及任务提交时的处理流程。", "correct_answer": "任务提交时的处理流程：1) 若当前线程数小于核心线程数，创建新的核心线程执行任务；2) 若核心线程数已满，任务放入工作队列等待；3) 若工作队列已满且当前线程数小于最大线程数，创建非核心线程执行任务；4) 若工作队列已满且线程数达到最大线程数，执行拒绝策略。核心线程数是线程池维持的最小线程数，最大线程数是允许的最大线程数量，工作队列缓冲待执行的任务。", "answer_analysis": "理解线程池的工作流程对于正确配置线程池参数至关重要。", "hints": json.dumps(["按顺序思考任务提交后的每一步处理", "注意队列满后的处理逻辑"], ensure_ascii=False), "knowledge_tags": json.dumps(["线程池", "ThreadPoolExecutor", "参数配置"], ensure_ascii=False), "score": 10.0, "estimated_minutes": 8},
            {"title": "实现线程安全的计数器", "exercise_type": "coding", "difficulty_level": "intermediate", "content": "请实现一个线程安全的计数器类，支持increment、decrement和getCount方法。要求：1) 使用ReentrantLock实现；2) 使用AtomicInteger实现。在主方法中启动10个线程，每个线程对计数器递增1000次，验证最终结果。", "correct_answer": "import java.util.concurrent.locks.*;\nimport java.util.concurrent.atomic.*;\n\nclass LockCounter {\n    private int count = 0; private final ReentrantLock lock = new ReentrantLock();\n    void increment() { lock.lock(); try { count++; } finally { lock.unlock(); } }\n    void decrement() { lock.lock(); try { count--; } finally { lock.unlock(); } }\n    int getCount() { lock.lock(); try { return count; } finally { lock.unlock(); } }\n}\n\nclass AtomicCounter {\n    private AtomicInteger count = new AtomicInteger(0);\n    void increment() { count.incrementAndGet(); }\n    void decrement() { count.decrementAndGet(); }\n    int getCount() { return count.get(); }\n}\n\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        LockCounter lc = new LockCounter(); AtomicCounter ac = new AtomicCounter();\n        Thread[] threads = new Thread[10];\n        for (int i = 0; i < 10; i++) { threads[i] = new Thread(() -> { for (int j = 0; j < 1000; j++) { lc.increment(); ac.increment(); } }); threads[i].start(); }\n        for (Thread t : threads) t.join();\n        System.out.println(\"LockCounter: \" + lc.getCount()); System.out.println(\"AtomicCounter: \" + ac.getCount());\n    }\n}", "answer_analysis": "本题考察两种线程安全实现方式的对比。ReentrantLock提供显式加锁解锁控制，AtomicInteger基于CAS无锁实现，性能更高。两种方式最终计数结果都应为10000。", "hints": json.dumps(["Lock必须在finally中释放", "AtomicInteger使用incrementAndGet方法"], ensure_ascii=False), "knowledge_tags": json.dumps(["线程安全", "ReentrantLock", "AtomicInteger", "CAS"], ensure_ascii=False), "score": 15.0, "estimated_minutes": 15},
        ],
    })

    # ===== 第5章 =====
    chapters.append({
        "title": "第5章 数据库操作与持久层框架",
        "order_index": 5, "teaching_hours": 10, "chapter_type": "theory",
        "description": "介绍数据库连接与SQL、持久层框架基础、动态查询与分页以及事务管理与连接池。",
        "objectives": ["掌握数据库连接与基本SQL操作", "理解持久层框架的核心原理与使用", "掌握动态查询与分页的实现方法", "理解事务管理机制与连接池配置"],
        "key_points": ["数据库连接", "持久层框架", "动态查询", "事务管理"],
        "difficulties": ["动态查询的原理", "事务传播行为", "连接池调优"],
        "teaching_methods": ["讲授", "案例分析", "编程实验"],
        "knowledge_points": [
            {"title": "数据库连接与SQL", "order_index": 1, "difficulty_level": "beginner", "importance": "core", "definition": "数据库连接是通过驱动程序建立应用程序与数据库之间的通信通道，SQL是操作关系型数据库的标准语言。", "content": "Java通过数据库连接（JDBC）API连接数据库。PreparedStatement使用预编译机制防止SQL注入攻击，同时提升重复执行的效率。\n\n基本操作：SELECT查询、INSERT插入、UPDATE更新、DELETE删除。事务通过setAutoCommit(false)开启手动提交，commit提交，rollback回滚。事务的ACID特性保证数据操作的可靠性。", "examples": json.dumps([{"title": "数据库基本操作", "code": "import java.sql.*;\n\npublic class JdbcDemo {\n    static void queryUsers() throws SQLException {\n        try (Connection conn = DriverManager.getConnection(\"jdbc:mysql://localhost:3306/mydb\", \"root\", \"password\");\n             PreparedStatement ps = conn.prepareStatement(\"SELECT id, name, age FROM users WHERE age > ?\")) {\n            ps.setInt(1, 18);\n            try (ResultSet rs = ps.executeQuery()) {\n                while (rs.next()) { System.out.printf(\"ID:%d 姓名:%s 年龄:%d%n\", rs.getInt(\"id\"), rs.getString(\"name\"), rs.getInt(\"age\")); }\n            }\n        }\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["数据库连接", "SQL", "PreparedStatement", "事务"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["基本数据类型与运算"], ensure_ascii=False), "related_concepts": json.dumps(["关系型数据库", "数据库索引", "数据库范式"], ensure_ascii=False)},
            {"title": "持久层框架基础", "order_index": 2, "difficulty_level": "intermediate", "importance": "core", "definition": "持久层框架是简化数据库操作的开发框架，通过对象关系映射将数据库表映射为Java对象，开发者只需操作对象即可完成数据库操作。", "content": "MyBatis是Java最流行的持久层框架之一，核心思想是将SQL与Java代码分离。通过XML映射文件或注解定义SQL。\n\nJPA是Java的持久化标准，Hibernate是其最流行的实现。Spring Data JPA通过方法命名约定自动生成查询。\n\n选择MyBatis还是JPA：MyBatis对SQL控制更精细；JPA开发效率更高。", "examples": json.dumps([{"title": "MyBatis映射示例", "code": "public interface UserMapper {\n    @Select(\"SELECT * FROM users WHERE id = #{id}\")\n    User findById(@Param(\"id\") Long id);\n\n    @Insert(\"INSERT INTO users(name, age, email) VALUES(#{name}, #{age}, #{email})\")\n    @Options(useGeneratedKeys = true, keyProperty = \"id\")\n    void insert(User user);\n\n    List<User> findByNameAndAge(@Param(\"name\") String name, @Param(\"minAge\") Integer minAge);\n}"}], ensure_ascii=False), "tags": json.dumps(["持久层框架", "MyBatis", "JPA", "对象关系映射"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["数据库连接与SQL"], ensure_ascii=False), "related_concepts": json.dumps(["对象关系映射", "延迟加载", "缓存机制"], ensure_ascii=False)},
            {"title": "动态查询与分页", "order_index": 3, "difficulty_level": "intermediate", "importance": "core", "definition": "动态查询是根据运行时条件动态拼接SQL的技术，分页是将大量数据分批查询展示的机制。", "content": "MyBatis的动态查询标签：if条件判断、where智能添加WHERE关键字、set智能添加SET关键字、foreach批量操作。\n\nPageHelper是MyBatis最常用的分页插件，通过拦截器自动添加分页语句。Spring Data JPA使用Pageable接口实现分页。", "examples": json.dumps([{"title": "MyBatis动态查询与分页", "code": "import com.github.pagehelper.PageHelper;\nimport com.github.pagehelper.PageInfo;\n\npublic class UserService {\n    private UserMapper userMapper;\n    public PageInfo<User> search(String name, Integer minAge, Integer maxAge, int page, int size) {\n        PageHelper.startPage(page, size);\n        List<User> users = userMapper.searchUsers(name, minAge, maxAge);\n        return new PageInfo<>(users);\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["动态查询", "分页", "MyBatis", "PageHelper"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["持久层框架基础"], ensure_ascii=False), "related_concepts": json.dumps(["查询优化", "索引使用", "批量操作"], ensure_ascii=False)},
            {"title": "事务管理与连接池", "order_index": 4, "difficulty_level": "advanced", "importance": "core", "definition": "事务管理是保证数据库操作原子性和一致性的机制，连接池是管理数据库连接的缓存池。", "content": "Spring框架提供声明式事务，通过@Transactional注解实现。事务传播行为：REQUIRED（默认）、REQUIRES_NEW、NESTED等。\n\n事务隔离级别：READ_UNCOMMITTED、READ_COMMITTED、REPEATABLE_READ（MySQL默认）、SERIALIZABLE。\n\n常用连接池：HikariCP（性能最优，Spring Boot默认）、Druid（功能丰富，监控完善）。", "examples": json.dumps([{"title": "事务管理", "code": "@Service\npublic class OrderService {\n    @Autowired private OrderMapper orderMapper;\n    @Autowired private ProductMapper productMapper;\n\n    @Transactional(rollbackFor = Exception.class)\n    public void createOrder(Order order) {\n        orderMapper.insert(order);\n        productMapper.decreaseStock(order.getProductId(), order.getQuantity());\n    }\n\n    @Transactional(propagation = Propagation.REQUIRES_NEW)\n    public void logOperation(String operation) { /* 独立事务 */ }\n}"}], ensure_ascii=False), "tags": json.dumps(["事务管理", "连接池", "HikariCP", "传播行为"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["持久层框架基础", "数据库连接与SQL"], ensure_ascii=False), "related_concepts": json.dumps(["分布式事务", "两阶段提交", "补偿事务"], ensure_ascii=False)},
        ],
        "teaching_cases": [
            {"title": "用户权限管理系统", "case_type": "application", "background": "企业应用需要实现用户权限管理系统，支持用户注册、角色分配、权限控制等功能。", "problem_description": "使用持久层框架和事务管理实现用户权限管理系统，支持用户增删改查、角色分配、权限校验。", "analysis": "1. 用户-角色-权限三表关联设计\n2. 使用MyBatis实现数据访问层\n3. 事务管理保证操作原子性\n4. 动态查询支持多条件搜索", "solution": "1. 设计用户表、角色表、权限表及关联表\n2. 编写Mapper接口和XML映射文件\n3. Service层使用@Transactional管理事务\n4. 使用PageHelper实现分页查询", "conclusion": "用户权限管理系统综合运用了持久层框架、事务管理和动态查询等技术。MyBatis简化了数据库操作，声明式事务保证了数据一致性。", "code_example": "@Service\npublic class UserService {\n    @Autowired private UserMapper userMapper;\n\n    @Transactional(rollbackFor = Exception.class)\n    public void createUserWithRole(User user, Long roleId) {\n        userMapper.insert(user);\n        userMapper.insertUserRole(user.getId(), roleId);\n    }\n\n    public PageInfo<User> search(String username, String roleName, int page, int size) {\n        PageHelper.startPage(page, size);\n        return new PageInfo<>(userMapper.searchUsers(username, roleName));\n    }\n}", "difficulty_level": "intermediate", "tags": json.dumps(["持久层框架", "事务管理", "权限管理", "分页"], ensure_ascii=False)},
        ],
        "exercises": [
            {"title": "PreparedStatement优势", "exercise_type": "choice", "difficulty_level": "beginner", "content": "相比于Statement，PreparedStatement的主要优势不包括：", "options": json.dumps(["防止SQL注入", "预编译提升重复执行效率", "支持批量操作", "自动生成表结构"], ensure_ascii=False), "correct_answer": 3, "answer_analysis": "PreparedStatement不能自动生成表结构，表结构需要通过DDL语句定义。", "hints": json.dumps(["思考PreparedStatement的核心特性", "排除不属于其功能的选项"], ensure_ascii=False), "knowledge_tags": json.dumps(["PreparedStatement", "SQL注入", "预编译"], ensure_ascii=False), "score": 5.0, "estimated_minutes": 3},
            {"title": "事务隔离级别", "exercise_type": "choice", "difficulty_level": "intermediate", "content": "以下哪种事务隔离级别可以防止幻读？", "options": json.dumps(["READ_UNCOMMITTED", "READ_COMMITTED", "REPEATABLE_READ", "SERIALIZABLE"], ensure_ascii=False), "correct_answer": 3, "answer_analysis": "SERIALIZABLE（串行化）是最高的隔离级别，可以防止脏读、不可重复读和幻读。", "hints": json.dumps(["回忆四种隔离级别各自防止的问题", "幻读是最高级别才能完全防止的"], ensure_ascii=False), "knowledge_tags": json.dumps(["事务隔离", "幻读", "并发问题"], ensure_ascii=False), "score": 5.0, "estimated_minutes": 3},
            {"title": "实现通用分页查询", "exercise_type": "coding", "difficulty_level": "advanced", "content": "请使用MyBatis实现一个通用的分页查询功能：1) 定义PageRequest类封装分页参数；2) 定义PageResult类封装分页结果；3) 编写Mapper的动态查询，支持按用户名模糊搜索和按状态精确筛选；4) Service层组装分页结果。", "correct_answer": "public class PageRequest { private int pageNum = 1; private int pageSize = 10; }\npublic class PageResult<T> { private List<T> records; private long total; private int pages; public PageResult(List<T> records, long total, int pageSize) { this.records = records; this.total = total; this.pages = (int) Math.ceil((double) total / pageSize); } }\n\n@Service\npublic class UserService {\n    @Autowired private UserMapper userMapper;\n    public PageResult<User> search(String username, Integer status, PageRequest req) {\n        int offset = (req.getPageNum() - 1) * req.getPageSize();\n        List<User> records = userMapper.search(username, status, offset, req.getPageSize());\n        long total = userMapper.searchCount(username, status);\n        return new PageResult<>(records, total, req.getPageSize());\n    }\n}", "answer_analysis": "本题考察分页查询的完整实现。LIMIT子句实现物理分页，动态查询标签拼接条件，PageResult封装分页元数据。", "hints": json.dumps(["使用LIMIT实现物理分页", "动态查询使用where和if标签", "分页结果需包含总记录数和总页数"], ensure_ascii=False), "knowledge_tags": json.dumps(["分页查询", "动态查询", "MyBatis", "通用组件"], ensure_ascii=False), "score": 15.0, "estimated_minutes": 15},
        ],
    })

    # ===== 第6章 =====
    chapters.append({
        "title": "第6章 Spring框架核心",
        "order_index": 6, "teaching_hours": 12, "chapter_type": "theory",
        "description": "介绍Spring框架的核心技术，包括控制反转与依赖注入、面向切面编程、Spring Boot自动配置以及接口开发与参数校验。",
        "objectives": ["理解控制反转与依赖注入的原理和使用", "掌握面向切面编程的应用场景与实现", "掌握Spring Boot的自动配置原理", "能够开发接口并实现参数校验"],
        "key_points": ["控制反转", "依赖注入", "面向切面编程", "Spring Boot"],
        "difficulties": ["面向切面编程的底层实现", "自动配置原理", "循环依赖问题"],
        "teaching_methods": ["讲授", "案例分析", "编程实验"],
        "knowledge_points": [
            {"title": "控制反转与依赖注入", "order_index": 1, "difficulty_level": "intermediate", "importance": "core", "definition": "控制反转是一种设计原则，将对象的创建和依赖管理从程序代码中转移到外部容器；依赖注入是控制反转的实现方式。", "content": "依赖注入的三种方式：构造器注入（推荐）、Setter注入（可选依赖）、字段注入（@Autowired，简洁但不推荐）。\n\nSpring框架的IoC容器包括BeanFactory和ApplicationContext。Bean的作用域：singleton（默认）、prototype等。\n\n@Qualifier指定注入哪个实现类，@Primary标记默认实现。", "examples": json.dumps([{"title": "依赖注入使用", "code": "@Service\npublic class UserService {\n    private final UserRepository userRepository;\n    private final EmailService emailService;\n    @Autowired\n    public UserService(UserRepository userRepository, EmailService emailService) {\n        this.userRepository = userRepository; this.emailService = emailService;\n    }\n    public void registerUser(String username, String email) {\n        userRepository.save(new User(username, email));\n        emailService.sendWelcome(email, username);\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["控制反转", "依赖注入", "Bean", "容器"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["面向对象基础", "抽象类与接口"], ensure_ascii=False), "related_concepts": json.dumps(["设计模式", "依赖倒置原则", "Bean生命周期"], ensure_ascii=False)},
            {"title": "面向切面编程", "order_index": 2, "difficulty_level": "advanced", "importance": "core", "definition": "面向切面编程是一种编程范式，将横切关注点从业务逻辑中分离出来，通过切面统一管理。", "content": "核心概念：切面、连接点、切入点、通知。五种通知类型：@Before、@After、@AfterReturning、@AfterThrowing、@Around。\n\n典型应用：日志记录、性能监控、事务管理、权限校验。底层实现：JDK动态代理和CGLIB动态代理。", "examples": json.dumps([{"title": "面向切面编程实现日志切面", "code": "@Aspect\n@Component\npublic class LoggingAspect {\n    @Around(\"execution(* com.example.service.*.*(..))\")\n    public Object logMethod(ProceedingJoinPoint pjp) throws Throwable {\n        String methodName = pjp.getSignature().getName();\n        long start = System.currentTimeMillis();\n        try {\n            Object result = pjp.proceed();\n            System.out.printf(\"[成功] %s 耗时:%dms%n\", methodName, System.currentTimeMillis() - start);\n            return result;\n        } catch (Exception e) {\n            System.out.printf(\"[异常] %s 异常:%s%n\", methodName, e.getMessage());\n            throw e;\n        }\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["面向切面编程", "切面", "通知", "动态代理"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["控制反转与依赖注入", "抽象类与接口"], ensure_ascii=False), "related_concepts": json.dumps(["动态代理", "装饰器模式", "横切关注点"], ensure_ascii=False)},
            {"title": "Spring Boot自动配置", "order_index": 3, "difficulty_level": "intermediate", "importance": "core", "definition": "Spring Boot是Spring框架的快速开发脚手架，通过自动配置、起步依赖和内嵌服务器简化了春季应用的创建和配置过程。", "content": "自动配置原理：@SpringBootApplication包含@EnableAutoConfiguration，通过SpringFactories机制加载自动配置类。条件注解：@ConditionalOnClass、@ConditionalOnMissingBean、@ConditionalOnProperty等。\n\n配置文件application.yml支持多环境配置。@ConfigurationProperties将配置属性绑定到Bean。", "examples": json.dumps([{"title": "Spring Boot应用示例", "code": "@SpringBootApplication\npublic class Application {\n    public static void main(String[] args) { SpringApplication.run(Application.class, args); }\n}\n\n@RestController\n@RequestMapping(\"/api\")\npublic class HelloController {\n    @Value(\"${app.greeting:你好}\")\n    private String greeting;\n    @GetMapping(\"/hello\")\n    public String hello(@RequestParam(defaultValue = \"世界\") String name) { return greeting + \", \" + name + \"!\"; }\n}"}], ensure_ascii=False), "tags": json.dumps(["Spring Boot", "自动配置", "起步依赖", "配置文件"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["控制反转与依赖注入"], ensure_ascii=False), "related_concepts": json.dumps(["条件注解", "自定义Starter", "Actuator"], ensure_ascii=False)},
            {"title": "接口开发与参数校验", "order_index": 4, "difficulty_level": "intermediate", "importance": "core", "definition": "接口开发是构建前后端分离应用的核心技能，参数校验是保证接口数据合法性的重要手段。", "content": "RESTful接口设计原则：使用HTTP方法表示操作，URL表示资源。参数接收：@RequestParam、@PathVariable、@RequestBody。\n\n参数校验使用JSR-303注解：@NotNull、@NotBlank、@Size、@Email等。全局异常处理器使用@ControllerAdvice+@ExceptionHandler统一处理异常。", "examples": json.dumps([{"title": "接口开发与参数校验", "code": "@RestController\n@RequestMapping(\"/api/users\")\npublic class UserController {\n    @Autowired private UserService userService;\n    @PostMapping\n    public Result<User> createUser(@Valid @RequestBody UserDTO dto) { return Result.success(userService.create(dto)); }\n    @GetMapping(\"/{id}\")\n    public Result<User> getUser(@PathVariable Long id) { return Result.success(userService.findById(id)); }\n}\n\npublic class UserDTO {\n    @NotBlank(message = \"用户名不能为空\") @Size(min = 2, max = 20, message = \"用户名长度2-20个字符\")\n    private String username;\n    @NotBlank(message = \"邮箱不能为空\") @Email(message = \"邮箱格式不正确\")\n    private String email;\n}"}], ensure_ascii=False), "tags": json.dumps(["接口开发", "参数校验", "RESTful", "异常处理"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["Spring Boot自动配置", "控制反转与依赖注入"], ensure_ascii=False), "related_concepts": json.dumps(["接口文档", "JWT认证", "跨域处理"], ensure_ascii=False)},
        ],
        "teaching_cases": [
            {"title": "在线商城接口服务", "case_type": "application", "background": "某在线商城需要开发后端接口服务，支持商品管理、购物车操作和订单处理。", "problem_description": "使用Spring框架开发在线商城接口服务，实现商品增删改查、购物车管理和订单创建功能。", "analysis": "1. 采用分层架构：Controller-Service-Mapper\n2. RESTful风格设计接口\n3. 参数校验保证数据合法性\n4. 事务管理保证操作原子性", "solution": "1. 定义实体类和DTO\n2. Controller层接收请求\n3. Service层实现业务逻辑\n4. 全局异常处理器统一错误响应", "conclusion": "在线商城接口服务展示了Spring框架在企业级开发中的典型应用。依赖注入降低了组件耦合，声明式事务保证了数据一致性。", "code_example": "@RestController\n@RequestMapping(\"/api/orders\")\npublic class OrderController {\n    @Autowired private OrderService orderService;\n    @PostMapping\n    public Result<OrderVO> createOrder(@Valid @RequestBody CreateOrderDTO dto) { return Result.success(orderService.createOrder(dto)); }\n}\n\n@Service\npublic class OrderService {\n    @Autowired private OrderMapper orderMapper;\n    @Autowired private ProductMapper productMapper;\n    @Transactional(rollbackFor = Exception.class)\n    public OrderVO createOrder(CreateOrderDTO dto) {\n        for (OrderItemDTO item : dto.getItems()) {\n            int affected = productMapper.decreaseStock(item.getProductId(), item.getQuantity());\n            if (affected == 0) throw new BusinessException(\"库存不足\");\n        }\n        Order order = new Order(dto.getUserId(), dto.getItems());\n        orderMapper.insert(order);\n        return OrderVO.from(order);\n    }\n}", "difficulty_level": "intermediate", "tags": json.dumps(["Spring框架", "接口开发", "事务管理", "商城系统"], ensure_ascii=False)},
        ],
        "exercises": [
            {"title": "依赖注入方式", "exercise_type": "choice", "difficulty_level": "beginner", "content": "以下哪种依赖注入方式是Spring框架推荐的？", "options": json.dumps(["字段注入", "Setter注入", "构造器注入", "静态工厂注入"], ensure_ascii=False), "correct_answer": 2, "answer_analysis": "Spring框架官方推荐构造器注入，保证依赖不可变、不为null、对象创建时处于完整状态。", "hints": json.dumps(["思考哪种注入方式能保证对象完整性", "回忆春季官方文档的推荐"], ensure_ascii=False), "knowledge_tags": json.dumps(["依赖注入", "构造器注入", "最佳实践"], ensure_ascii=False), "score": 5.0, "estimated_minutes": 3},
            {"title": "面向切面编程应用场景", "exercise_type": "short_answer", "difficulty_level": "intermediate", "content": "请列举面向切面编程的三个典型应用场景，并说明每个场景中切面如何简化代码。", "correct_answer": "1)日志记录：通过切面统一记录方法调用日志，避免在每个方法中重复编写日志代码。2)事务管理：通过切面在方法执行前开启事务，执行后提交或回滚，业务代码无需关心事务逻辑。3)权限校验：通过切面在方法执行前检查用户权限，避免在每个接口中重复编写权限判断代码。", "answer_analysis": "面向切面编程的核心价值是将横切关注点从业务逻辑中分离，实现关注点分离。", "hints": json.dumps(["思考哪些功能需要在多个方法中重复实现", "这些功能与业务逻辑是否相关"], ensure_ascii=False), "knowledge_tags": json.dumps(["面向切面编程", "横切关注点", "日志", "事务"], ensure_ascii=False), "score": 10.0, "estimated_minutes": 8},
            {"title": "实现用户注册接口", "exercise_type": "coding", "difficulty_level": "intermediate", "content": "请使用Spring框架实现用户注册接口：1) 定义UserDTO，添加校验注解；2) 定义UserController，实现POST /api/users/register接口；3) 定义UserService，实现注册逻辑；4) 定义全局异常处理器。", "correct_answer": "public class UserDTO {\n    @NotBlank(message = \"用户名不能为空\") @Size(min = 2, max = 20, message = \"用户名长度2-20个字符\")\n    private String username;\n    @NotBlank(message = \"密码不能为空\") @Size(min = 6, max = 20, message = \"密码长度6-20个字符\")\n    private String password;\n    @NotBlank(message = \"邮箱不能为空\") @Email(message = \"邮箱格式不正确\")\n    private String email;\n}\n\n@RestController\n@RequestMapping(\"/api/users\")\npublic class UserController {\n    @Autowired private UserService userService;\n    @PostMapping(\"/register\")\n    public Result<?> register(@Valid @RequestBody UserDTO dto) { userService.register(dto); return Result.success(\"注册成功\"); }\n}\n\n@Service\npublic class UserService {\n    @Autowired private UserMapper userMapper;\n    public void register(UserDTO dto) {\n        if (userMapper.findByUsername(dto.getUsername()) != null) throw new BusinessException(\"用户名已存在\");\n        User user = new User(); user.setUsername(dto.getUsername()); user.setPassword(encryptPassword(dto.getPassword())); user.setEmail(dto.getEmail());\n        userMapper.insert(user);\n    }\n}\n\n@ControllerAdvice\npublic class GlobalExceptionHandler {\n    @ExceptionHandler(MethodArgumentNotValidException.class)\n    public Result<?> handleValidation(MethodArgumentNotValidException e) {\n        String msg = e.getBindingResult().getFieldErrors().stream().map(f -> f.getField() + \": \" + f.getDefaultMessage()).collect(Collectors.joining(\"; \"));\n        return Result.fail(400, msg);\n    }\n}", "answer_analysis": "本题考察Spring框架接口开发的完整流程：DTO校验、Controller接口定义、Service业务逻辑、异常统一处理。", "hints": json.dumps(["使用@Valid触发参数校验", "密码需要加密存储", "全局异常处理器统一返回格式"], ensure_ascii=False), "knowledge_tags": json.dumps(["Spring框架", "接口开发", "参数校验", "异常处理"], ensure_ascii=False), "score": 15.0, "estimated_minutes": 15},
        ],
    })

    # ===== 第7章 =====
    chapters.append({
        "title": "第7章 中间件与分布式技术",
        "order_index": 7, "teaching_hours": 10, "chapter_type": "theory",
        "description": "介绍缓存服务、消息队列、搜索引擎以及接口网关与负载均衡等中间件和分布式技术。",
        "objectives": ["掌握缓存服务的使用场景与最佳实践", "理解消息队列的作用与常用模式", "了解搜索引擎的基本原理与使用", "理解接口网关与负载均衡的作用"],
        "key_points": ["缓存服务", "消息队列", "搜索引擎", "接口网关"],
        "difficulties": ["缓存一致性", "消息可靠性", "分布式系统复杂性"],
        "teaching_methods": ["讲授", "案例分析", "编程实验"],
        "knowledge_points": [
            {"title": "缓存服务", "order_index": 1, "difficulty_level": "intermediate", "importance": "core", "definition": "缓存服务是基于内存的高性能键值存储系统，通过将热点数据缓存在内存中减少数据库访问，显著提升系统响应速度和并发能力。", "content": "Redis是最流行的缓存服务，支持字符串、哈希、列表、集合、有序集合等数据类型。缓存策略：Cache Aside（最常用）、Read Through/Write Through、Write Behind。\n\n缓存问题：缓存穿透（布隆过滤器解决）、缓存击穿（互斥锁解决）、缓存雪崩（随机过期时间解决）。Spring Data Redis提供了简洁的Redis操作API。", "examples": json.dumps([{"title": "Redis缓存使用", "code": "@Service\npublic class ProductService {\n    @Autowired private ProductMapper productMapper;\n    @Autowired private RedisTemplate<String, Object> redisTemplate;\n    private static final String CACHE_PREFIX = \"product:\";\n    private static final long CACHE_TTL = 30;\n    public Product findById(Long id) {\n        String key = CACHE_PREFIX + id;\n        Product product = (Product) redisTemplate.opsForValue().get(key);\n        if (product != null) return product;\n        product = productMapper.findById(id);\n        if (product != null) redisTemplate.opsForValue().set(key, product, CACHE_TTL, TimeUnit.MINUTES);\n        return product;\n    }\n    public void update(Product product) { productMapper.update(product); redisTemplate.delete(CACHE_PREFIX + product.getId()); }\n}"}], ensure_ascii=False), "tags": json.dumps(["缓存服务", "Redis", "缓存策略", "缓存问题"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["Spring Boot自动配置"], ensure_ascii=False), "related_concepts": json.dumps(["布隆过滤器", "分布式锁", "数据分片"], ensure_ascii=False)},
            {"title": "消息队列", "order_index": 2, "difficulty_level": "intermediate", "importance": "core", "definition": "消息队列是分布式系统中用于异步通信的中间件，实现系统间的解耦、异步和流量削峰。", "content": "核心作用：解耦、异步、削峰。常用消息队列：RabbitMQ、Kafka、RocketMQ。\n\n消息可靠性保证：生产者确认、消息持久化、消费者手动确认。幂等性设计保证消息重复消费不影响结果。Spring AMQP简化了RabbitMQ的使用。", "examples": json.dumps([{"title": "RabbitMQ消息发送与接收", "code": "@Service\npublic class OrderEventPublisher {\n    @Autowired private RabbitTemplate rabbitTemplate;\n    public void publishOrderCreated(Order order) { rabbitTemplate.convertAndSend(\"order.exchange\", \"order.created\", order); }\n}\n\n@Component\npublic class InventoryConsumer {\n    @Autowired private InventoryService inventoryService;\n    @RabbitListener(queues = \"inventory.queue\")\n    public void handleOrderCreated(Order order) { inventoryService.reserveStock(order); }\n}"}], ensure_ascii=False), "tags": json.dumps(["消息队列", "RabbitMQ", "异步通信", "解耦"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["Spring Boot自动配置"], ensure_ascii=False), "related_concepts": json.dumps(["事件驱动架构", "消息幂等性", "死信队列"], ensure_ascii=False)},
            {"title": "搜索引擎", "order_index": 3, "difficulty_level": "intermediate", "importance": "supplementary", "definition": "搜索引擎是基于倒排索引的全文检索系统，能够快速从大量文档中查找包含指定关键词的内容。", "content": "Elasticsearch是最流行的分布式搜索引擎，基于Lucene构建。核心概念：索引、文档、映射。倒排索引是核心数据结构。\n\nSpring Data Elasticsearch提供了面向对象的搜索API。搜索优化：合理设计映射、使用分词器、利用聚合分析。", "examples": json.dumps([{"title": "Elasticsearch搜索示例", "code": "@Document(indexName = \"products\")\npublic class Product {\n    @Id private String id;\n    @Field(type = FieldType.Text, analyzer = \"ik_max_word\") private String name;\n    @Field(type = FieldType.Double) private double price;\n    @Field(type = FieldType.Keyword) private String category;\n}\n\n@Service\npublic class ProductSearchService {\n    @Autowired private ElasticsearchRestTemplate esTemplate;\n    public SearchHits<Product> search(String keyword, String category, int page, int size) {\n        BoolQueryBuilder boolQuery = QueryBuilders.boolQuery();\n        if (keyword != null) boolQuery.must(QueryBuilders.multiMatchQuery(keyword, \"name\", \"description\"));\n        if (category != null) boolQuery.filter(QueryBuilders.termQuery(\"category\", category));\n        NativeSearchQuery query = new NativeSearchQueryBuilder().withQuery(boolQuery).withPageable(PageRequest.of(page, size)).build();\n        return esTemplate.search(query, Product.class);\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["搜索引擎", "Elasticsearch", "全文检索", "倒排索引"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["Spring Boot自动配置"], ensure_ascii=False), "related_concepts": json.dumps(["分词器", "相关性评分", "聚合分析"], ensure_ascii=False)},
            {"title": "接口网关与负载均衡", "order_index": 4, "difficulty_level": "advanced", "importance": "core", "definition": "接口网关是微服务架构的统一入口，负责请求路由、认证鉴权、限流熔断等横切功能；负载均衡将请求分发到多个服务实例。", "content": "Spring Cloud Gateway是网关组件，核心概念：Route、Predicate、Filter。网关功能：请求路由、认证鉴权、限流、熔断、日志监控。\n\n负载均衡：Spring Cloud LoadBalancer（客户端）、Nginx（服务端）。服务发现（Nacos、Eureka）与负载均衡配合，动态路由请求。", "examples": json.dumps([{"title": "网关配置示例", "code": "@Component\npublic class AuthFilter implements GlobalFilter {\n    @Override\n    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {\n        String token = exchange.getRequest().getHeaders().getFirst(\"Authorization\");\n        if (token == null || !validateToken(token)) {\n            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);\n            return exchange.getResponse().setComplete();\n        }\n        return chain.filter(exchange);\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["接口网关", "负载均衡", "Spring Cloud Gateway", "Nginx"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["Spring Boot自动配置", "接口开发与参数校验"], ensure_ascii=False), "related_concepts": json.dumps(["服务发现", "限流算法", "熔断降级"], ensure_ascii=False)},
        ],
        "teaching_cases": [
            {"title": "秒杀系统设计", "case_type": "application", "background": "电商秒杀活动在短时间内产生大量并发请求，对系统的高并发处理能力、数据一致性和稳定性提出了极高要求。", "problem_description": "设计一个秒杀系统，支持高并发下单、库存防超卖、限流防刷和订单异步处理。", "analysis": "1. 高并发：缓存预热商品信息\n2. 防超卖：Redis原子操作扣减库存\n3. 限流：网关层令牌桶限流\n4. 异步：消息队列异步创建订单", "solution": "1. 活动开始前将商品和库存加载到Redis\n2. 请求经网关限流后到达秒杀接口\n3. Redis原子扣减库存\n4. 库存扣减成功后发送消息到队列\n5. 消费者创建订单", "conclusion": "秒杀系统综合运用了缓存、消息队列、分布式锁和限流等中间件技术。Redis原子操作保证了库存一致性，消息队列实现了流量削峰。", "code_example": "@Service\npublic class SeckillService {\n    @Autowired private RedisTemplate<String, Object> redisTemplate;\n    @Autowired private RabbitTemplate rabbitTemplate;\n    private static final String STOCK_KEY = \"seckill:stock:\";\n    private static final String ORDER_KEY = \"seckill:order:\";\n\n    public SeckillResult seckill(Long userId, Long productId) {\n        String orderKey = ORDER_KEY + productId + \":\" + userId;\n        Boolean isFirst = redisTemplate.opsForValue().setIfAbsent(orderKey, \"1\", 5, TimeUnit.MINUTES);\n        if (!isFirst) return SeckillResult.fail(\"请勿重复下单\");\n        Long stock = redisTemplate.opsForValue().decrement(STOCK_KEY + productId);\n        if (stock == null || stock < 0) {\n            redisTemplate.opsForValue().increment(STOCK_KEY + productId);\n            return SeckillResult.fail(\"商品已售罄\");\n        }\n        SeckillMessage message = new SeckillMessage(userId, productId);\n        rabbitTemplate.convertAndSend(\"seckill.exchange\", \"seckill.order\", message);\n        return SeckillResult.success(\"排队中\");\n    }\n}", "difficulty_level": "advanced", "tags": json.dumps(["秒杀", "高并发", "Redis", "消息队列", "分布式锁"], ensure_ascii=False)},
        ],
        "exercises": [
            {"title": "缓存问题识别", "exercise_type": "choice", "difficulty_level": "intermediate", "content": "大量请求查询数据库中不存在的数据，导致请求全部打到数据库，这种现象称为：", "options": json.dumps(["缓存雪崩", "缓存击穿", "缓存穿透", "缓存预热"], ensure_ascii=False), "correct_answer": 2, "answer_analysis": "缓存穿透是指查询不存在的数据，绕过缓存直接访问数据库。解决方案：布隆过滤器、空值缓存。", "hints": json.dumps(["区分三种缓存问题的定义", "注意\"不存在的数据\"这个关键信息"], ensure_ascii=False), "knowledge_tags": json.dumps(["缓存穿透", "缓存问题", "Redis"], ensure_ascii=False), "score": 5.0, "estimated_minutes": 3},
            {"title": "消息队列作用", "exercise_type": "short_answer", "difficulty_level": "intermediate", "content": "请解释消息队列在分布式系统中的三大核心作用（解耦、异步、削峰），并各举一个实际应用场景。", "correct_answer": "1)解耦：生产者和消费者无需直接依赖。场景：订单系统发消息，库存和物流系统各自消费。2)异步：非关键路径异步执行。场景：注册后异步发送邮件。3)削峰：高峰期请求堆积在队列中。场景：秒杀活动消息缓冲后按能力消费。", "answer_analysis": "理解消息队列的三大核心作用是正确使用消息队列的前提。", "hints": json.dumps(["分别思考三个作用解决的问题", "每个作用举一个具体场景"], ensure_ascii=False), "knowledge_tags": json.dumps(["消息队列", "解耦", "异步", "削峰"], ensure_ascii=False), "score": 10.0, "estimated_minutes": 8},
            {"title": "实现缓存与数据库一致性方案", "exercise_type": "coding", "difficulty_level": "advanced", "content": "请实现一个CacheManager工具类，采用Cache Aside模式管理缓存与数据库的一致性。要求：1) get方法先查缓存，未命中查数据库并回填；2) put方法更新数据库后删除缓存；3) 支持设置缓存过期时间；4) 使用泛型支持任意类型。", "correct_answer": "import java.util.concurrent.*;\nimport java.util.function.*;\n\npublic class CacheManager {\n    private final Map<String, CacheEntry<?>> cache = new ConcurrentHashMap<>();\n    private static class CacheEntry<T> { T value; long expireTime; CacheEntry(T value, long ttlMs) { this.value = value; this.expireTime = System.currentTimeMillis() + ttlMs; } boolean isExpired() { return System.currentTimeMillis() > expireTime; } }\n    public <T> T get(String key, Supplier<T> dbLoader, long ttlMs) {\n        CacheEntry<?> entry = cache.get(key);\n        if (entry != null && !entry.isExpired()) return (T) entry.value;\n        T value = dbLoader.get();\n        if (value != null) cache.put(key, new CacheEntry<>(value, ttlMs));\n        return value;\n    }\n    public <T> void put(String key, Supplier<Void> dbUpdater, long ttlMs) { dbUpdater.get(); cache.remove(key); }\n    public void evict(String key) { cache.remove(key); }\n}", "answer_analysis": "本题考察Cache Aside模式的实现。get方法实现了缓存穿透查询和回填，put方法实现了先更新数据库再删除缓存的策略。", "hints": json.dumps(["get方法需要缓存穿透查询", "put方法先更新数据库再删除缓存", "使用ConcurrentHashMap保证线程安全"], ensure_ascii=False), "knowledge_tags": json.dumps(["缓存一致性", "Cache Aside", "Redis", "泛型"], ensure_ascii=False), "score": 15.0, "estimated_minutes": 15},
        ],
    })

    # ===== 第8章 =====
    chapters.append({
        "title": "第8章 微服务架构与部署",
        "order_index": 8, "teaching_hours": 8, "chapter_type": "theory",
        "description": "介绍微服务注册与发现、配置中心与服务治理、容器化部署以及持续集成与交付。",
        "objectives": ["理解微服务注册与发现的原理", "掌握配置中心的使用与服务治理策略", "掌握容器化部署的方法", "理解持续集成与交付的流程"],
        "key_points": ["服务注册与发现", "配置中心", "容器化", "持续集成"],
        "difficulties": ["服务治理策略", "容器编排", "持续交付流水线"],
        "teaching_methods": ["讲授", "案例分析", "编程实验"],
        "knowledge_points": [
            {"title": "微服务注册与发现", "order_index": 1, "difficulty_level": "intermediate", "importance": "core", "definition": "微服务注册与发现是微服务架构的基础设施，服务实例启动时将自身信息注册到注册中心，消费方从注册中心获取服务实例列表。", "content": "服务注册：服务实例启动时向注册中心发送注册请求，包含服务名、IP地址、端口等信息。注册中心维护服务实例列表，定期通过心跳检测实例健康状态。\n\n服务发现：消费方从注册中心获取目标服务的实例列表，结合负载均衡策略选择实例调用。\n\nNacos是阿里巴巴开源的注册中心，同时支持CP和AP模式，提供配置管理和服务发现一体化方案。Eureka是Netflix开源的注册中心，采用AP模式。", "examples": json.dumps([{"title": "Nacos服务注册配置", "code": "// application.yml\n// spring:\n//   application:\n//     name: user-service\n//   cloud:\n//     nacos:\n//       discovery:\n//         server-addr: localhost:8848\n//         namespace: dev\n\n// 启动类\n@SpringBootApplication\n@EnableDiscoveryClient\npublic class UserServiceApplication {\n    public static void main(String[] args) { SpringApplication.run(UserServiceApplication.class, args); }\n}\n\n// 服务调用\n@Service\npublic class OrderService {\n    @Autowired private RestTemplate restTemplate;\n    @LoadBalanced\n    public User getUser(Long userId) {\n        return restTemplate.getForObject(\"http://user-service/api/users/\" + userId, User.class);\n    }\n}"}], ensure_ascii=False), "tags": json.dumps(["服务注册", "服务发现", "Nacos", "Eureka"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["Spring Boot自动配置"], ensure_ascii=False), "related_concepts": json.dumps(["CAP理论", "心跳检测", "服务下线"], ensure_ascii=False)},
            {"title": "配置中心与服务治理", "order_index": 2, "difficulty_level": "intermediate", "importance": "core", "definition": "配置中心是集中管理微服务配置的组件，支持配置的动态更新；服务治理包括限流、熔断、降级等策略，保障微服务系统的稳定性。", "content": "Nacos Config提供配置的集中管理和动态推送。配置按dataId和group组织，支持命名空间隔离多环境。@RefreshScope注解实现配置的动态刷新。\n\n服务治理策略：限流（控制请求速率，令牌桶算法）、熔断（服务异常时快速失败，防止级联故障）、降级（服务不可用时返回兜底数据）。\n\nSentinel是阿里巴巴开源的流量治理组件，支持限流、熔断、系统保护和热点参数限流。@SentinelResource注解定义资源点，blockHandler处理限流，fallback处理异常。", "examples": json.dumps([{"title": "配置中心与服务治理", "code": "// 配置动态刷新\n@RestController\n@RefreshScope\npublic class ConfigController {\n    @Value(\"${app.config.max-connections:100}\")\n    private int maxConnections;\n    @GetMapping(\"/config\")\n    public String getConfig() { return \"最大连接数: \" + maxConnections; }\n}\n\n// Sentinel限流\n@Service\npublic class ProductService {\n    @SentinelResource(value = \"getProduct\", blockHandler = \"getProductBlock\", fallback = \"getProductFallback\")\n    public Product getProduct(Long id) { return productMapper.findById(id); }\n    public Product getProductBlock(Long id, BlockException ex) { return new Product(\"限流中\"); }\n    public Product getProductFallback(Long id, Throwable ex) { return new Product(\"服务降级\"); }\n}"}], ensure_ascii=False), "tags": json.dumps(["配置中心", "服务治理", "Nacos Config", "Sentinel"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["微服务注册与发现"], ensure_ascii=False), "related_concepts": json.dumps(["令牌桶算法", "滑动窗口", "服务降级"], ensure_ascii=False)},
            {"title": "容器化部署", "order_index": 3, "difficulty_level": "intermediate", "importance": "core", "definition": "容器化是将应用及其依赖打包到轻量级容器中的技术，保证应用在不同环境中一致运行。容器编排工具管理容器的生命周期和调度。", "content": "Docker是最流行的容器化平台。Dockerfile定义镜像构建步骤，docker build构建镜像，docker run运行容器。多阶段构建优化镜像大小。\n\nDocker Compose编排多容器应用，docker-compose.yml定义服务、网络和卷。适合开发和测试环境。\n\nKubernetes（K8s）是生产级容器编排平台。核心概念：Pod（最小调度单元）、Service（服务发现和负载均衡）、Deployment（声明式更新）、ConfigMap/Secret（配置管理）。\n\nSpring Boot应用容器化最佳实践：使用分层JAR、多阶段构建、健康检查端点、优雅停机。", "examples": json.dumps([{"title": "Dockerfile与K8s部署", "code": "# Dockerfile\n# FROM eclipse-temurin:17-jdk-alpine AS build\n# WORKDIR /app\n# COPY . .\n# RUN ./mvnw package -DskipTests\n#\n# FROM eclipse-temurin:17-jre-alpine\n# COPY --from=build /app/target/*.jar app.jar\n# EXPOSE 8080\n# ENTRYPOINT [\"java\", \"-jar\", \"app.jar\"]\n\n# K8s Deployment\n# apiVersion: apps/v1\n# kind: Deployment\n# metadata:\n#   name: user-service\n# spec:\n#   replicas: 3\n#   selector:\n#     matchLabels:\n#       app: user-service\n#   template:\n#     metadata:\n#       labels:\n#         app: user-service\n#     spec:\n#       containers:\n#       - name: user-service\n#         image: registry.example.com/user-service:latest\n#         ports:\n#         - containerPort: 8080\n#         livenessProbe:\n#           httpGet:\n#             path: /actuator/health/liveness\n#             port: 8080"}], ensure_ascii=False), "tags": json.dumps(["容器化", "Docker", "Kubernetes", "容器编排"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["Spring Boot自动配置"], ensure_ascii=False), "related_concepts": json.dumps(["镜像优化", "服务网格", " Helm"], ensure_ascii=False)},
            {"title": "持续集成与交付", "order_index": 4, "difficulty_level": "intermediate", "importance": "core", "definition": "持续集成是频繁将代码合并到主干并自动构建验证的实践；持续交付是在持续集成基础上自动部署到生产环境的实践。", "content": "持续集成（CI）流程：代码提交→自动构建→单元测试→代码质量检查→构建镜像。确保每次提交都是可构建、可测试的。\n\n持续交付（CD）流程：CI通过→集成测试→预发布环境部署→验收测试→生产环境部署。实现一键式发布。\n\n常用工具：Jenkins（老牌，插件丰富）、GitLab CI（与GitLab深度集成）、GitHub Actions（与GitHub集成，配置简单）。\n\n流水线即代码：使用Jenkinsfile或.github/workflows定义流水线，版本化管理。包括构建、测试、安全扫描、部署等阶段。\n\n蓝绿部署和金丝雀发布是两种常见的发布策略，降低发布风险。", "examples": json.dumps([{"title": "GitHub Actions流水线", "code": "# .github/workflows/ci.yml\n# name: CI/CD Pipeline\n# on:\n#   push:\n#     branches: [main]\n#   pull_request:\n#     branches: [main]\n#\n# jobs:\n#   build:\n#     runs-on: ubuntu-latest\n#     steps:\n#     - uses: actions/checkout@v3\n#     - name: Set up JDK 17\n#       uses: actions/setup-java@v3\n#       with:\n#         java-version: '17'\n#         distribution: 'temurin'\n#     - name: Build with Maven\n#       run: ./mvnw clean package\n#     - name: Run tests\n#       run: ./mvnw test\n#     - name: Build Docker image\n#       run: docker build -t user-service:${{ github.sha }} .\n#     - name: Deploy to staging\n#       if: github.ref == 'refs/heads/main'\n#       run: kubectl apply -f k8s/"}], ensure_ascii=False), "tags": json.dumps(["持续集成", "持续交付", "GitHub Actions", "流水线"], ensure_ascii=False), "formulas": json.dumps([], ensure_ascii=False), "prerequisites": json.dumps(["容器化部署"], ensure_ascii=False), "related_concepts": json.dumps(["蓝绿部署", "金丝雀发布", "DevOps"], ensure_ascii=False)},
        ],
        "teaching_cases": [
            {"title": "在线教育平台微服务", "case_type": "application", "background": "某在线教育平台需要从单体架构迁移到微服务架构，系统包括用户服务、课程服务、订单服务和通知服务。", "problem_description": "设计在线教育平台的微服务架构，实现服务的拆分、注册发现、配置管理、容器化部署和持续交付。", "analysis": "1. 按业务领域拆分服务\n2. 使用Nacos作为注册中心和配置中心\n3. 使用Spring Cloud Gateway作为网关\n4. 使用Docker和K8s进行容器化部署\n5. 使用GitHub Actions实现持续交付", "solution": "1. 拆分为用户服务、课程服务、订单服务、通知服务\n2. 每个服务独立数据库，通过接口通信\n3. 网关统一入口，认证鉴权\n4. Sentinel实现限流熔断\n5. Dockerfile构建镜像，K8s编排部署", "conclusion": "在线教育平台微服务架构展示了微服务拆分、治理和部署的完整流程。服务注册发现实现了动态扩缩容，配置中心实现了配置统一管理，容器化保证了环境一致性，持续交付提升了发布效率。", "code_example": "# docker-compose.yml\n# version: '3.8'\n# services:\n#   nacos:\n#     image: nacos/nacos-server:latest\n#     environment:\n#       MODE: standalone\n#     ports:\n#       - \"8848:8848\"\n#\n#   gateway:\n#     build: ./gateway\n#     ports:\n#       - \"8080:8080\"\n#     depends_on:\n#       - nacos\n#\n#   user-service:\n#     build: ./user-service\n#     depends_on:\n#       - nacos\n#       - mysql\n#\n#   course-service:\n#     build: ./course-service\n#     depends_on:\n#       - nacos\n#       - mysql\n#\n#   mysql:\n#     image: mysql:8.0\n#     environment:\n#       MYSQL_ROOT_PASSWORD: root\n#     ports:\n#       - \"3306:3306\"\n#\n#   redis:\n#     image: redis:7-alpine\n#     ports:\n#       - \"6379:6379\"", "difficulty_level": "advanced", "tags": json.dumps(["微服务", "容器化", "Nacos", "Kubernetes", "持续交付"], ensure_ascii=False)},
        ],
        "exercises": [
            {"title": "微服务拆分原则", "exercise_type": "choice", "difficulty_level": "intermediate", "content": "以下关于微服务拆分的原则，哪个说法是正确的？", "options": json.dumps(["微服务拆分越细越好", "每个微服务应该共享同一个数据库", "微服务应该按照业务领域进行拆分", "微服务之间应该直接调用数据库"], ensure_ascii=False), "correct_answer": 2, "answer_analysis": "微服务应该按照业务领域（限界上下文）进行拆分，每个服务有独立的业务边界。拆分过细会增加运维复杂度，每个服务应有独立数据库，服务间应通过接口通信而非直接访问数据库。", "hints": json.dumps(["思考领域驱动设计中的限界上下文", "微服务的独立性原则"], ensure_ascii=False), "knowledge_tags": json.dumps(["微服务拆分", "领域驱动设计", "服务边界"], ensure_ascii=False), "score": 5.0, "estimated_minutes": 3},
            {"title": "容器化优势", "exercise_type": "short_answer", "difficulty_level": "intermediate", "content": "请列举容器化部署的三个主要优势，并与传统虚拟机方式进行对比。", "correct_answer": "1)轻量级：容器共享宿主机内核，无需完整操作系统，启动速度快（秒级），资源占用少。虚拟机需要完整操作系统，启动慢（分钟级），资源占用大。2)一致性：容器将应用和依赖打包，保证开发、测试、生产环境一致。虚拟机虽然也能保证一致性，但镜像更大、迁移更慢。3)快速伸缩：容器可以快速创建和销毁，配合编排工具实现自动扩缩容。虚拟机扩容需要启动完整系统，速度较慢。", "answer_analysis": "容器化是现代应用部署的主流方式，理解其优势有助于做出正确的技术选型。", "hints": json.dumps(["对比容器和虚拟机的启动速度", "思考环境一致性问题", "考虑弹性伸缩能力"], ensure_ascii=False), "knowledge_tags": json.dumps(["容器化", "Docker", "虚拟机", "部署"], ensure_ascii=False), "score": 10.0, "estimated_minutes": 8},
            {"title": "编写微服务Dockerfile和部署配置", "exercise_type": "coding", "difficulty_level": "advanced", "content": "请为一个Spring Boot微服务编写：1) 多阶段构建的Dockerfile，使用JDK 17构建，JRE 17运行；2) Kubernetes Deployment配置，包含3个副本、健康检查和资源限制；3) Kubernetes Service配置，暴露8080端口。", "correct_answer": "# Dockerfile\nFROM eclipse-temurin:17-jdk-alpine AS build\nWORKDIR /app\nCOPY pom.xml .\nCOPY src ./src\nRUN ./mvnw clean package -DskipTests\n\nFROM eclipse-temurin:17-jre-alpine\nWORKDIR /app\nCOPY --from=build /app/target/*.jar app.jar\nEXPOSE 8080\nHEALTHCHECK --interval=30s --timeout=3s CMD wget -q --spider http://localhost:8080/actuator/health || exit 1\nENTRYPOINT [\"java\", \"-jar\", \"app.jar\"]\n\n# K8s Deployment\n# apiVersion: apps/v1\n# kind: Deployment\n# metadata:\n#   name: user-service\n# spec:\n#   replicas: 3\n#   selector:\n#     matchLabels:\n#       app: user-service\n#   template:\n#     metadata:\n#       labels:\n#         app: user-service\n#     spec:\n#       containers:\n#       - name: user-service\n#         image: user-service:latest\n#         ports:\n#         - containerPort: 8080\n#         resources:\n#           requests:\n#             memory: \"256Mi\"\n#             cpu: \"200m\"\n#           limits:\n#             memory: \"512Mi\"\n#             cpu: \"500m\"\n#         livenessProbe:\n#           httpGet:\n#             path: /actuator/health/liveness\n#             port: 8080\n#         readinessProbe:\n#           httpGet:\n#             path: /actuator/health/readiness\n#             port: 8080\n\n# K8s Service\n# apiVersion: v1\n# kind: Service\n# metadata:\n#   name: user-service\n# spec:\n#   selector:\n#     app: user-service\n#   ports:\n#   - port: 8080\n#     targetPort: 8080\n#   type: ClusterIP", "answer_analysis": "本题考察微服务容器化的完整配置。多阶段构建减小镜像大小，健康检查保证服务可用性，资源限制防止单个服务占用过多资源。", "hints": json.dumps(["多阶段构建先编译后运行", "健康检查使用actuator端点", "资源限制设置requests和limits"], ensure_ascii=False), "knowledge_tags": json.dumps(["Dockerfile", "Kubernetes", "容器化", "微服务部署"], ensure_ascii=False), "score": 15.0, "estimated_minutes": 15},
        ],
    })

    return chapters


JAVA_COURSE_DATA["chapters"] = _build_chapters()


def seed_java_course():
    with app.app_context():
        existing = Course.query.filter_by(title=JAVA_COURSE_DATA['course']['title']).first()
        if existing:
            print(f"[Seed] 课程'{JAVA_COURSE_DATA['course']['title']}'已存在 (ID={existing.id})，跳过创建")
            course_id = existing.id
        else:
            teacher = User.query.filter_by(role='teacher').first()
            if not teacher:
                teacher = User.query.filter_by(role='admin').first()
            if not teacher:
                print("[Seed] 错误：找不到教师用户，请先创建教师账户")
                return
            course_data = JAVA_COURSE_DATA['course']
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
            s_data = JAVA_COURSE_DATA['syllabus']
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

        for ch_data in JAVA_COURSE_DATA['chapters']:
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
                # Handle fields that may be pre-serialized strings or native Python objects
                tags_val = kp_data.get('tags', [])
                formulas_val = kp_data.get('formulas', [])
                examples_val = kp_data.get('examples', [])
                prerequisites_val = kp_data.get('prerequisites', [])
                related_concepts_val = kp_data.get('related_concepts', [])

                kp = KnowledgePoint(
                    course_id=course_id,
                    chapter_id=chapter.id,
                    title=kp_data['title'],
                    definition=kp_data.get('definition', ''),
                    content=kp_data.get('content', ''),
                    order_index=kp_data.get('order_index', 0),
                    difficulty_level=kp_data.get('difficulty_level', 'intermediate'),
                    importance=kp_data.get('importance', 'core'),
                    prerequisites=prerequisites_val if isinstance(prerequisites_val, str) else json.dumps(prerequisites_val, ensure_ascii=False),
                    related_concepts=related_concepts_val if isinstance(related_concepts_val, str) else json.dumps(related_concepts_val, ensure_ascii=False),
                    formulas=formulas_val if isinstance(formulas_val, str) else json.dumps(formulas_val, ensure_ascii=False),
                    examples=examples_val if isinstance(examples_val, str) else json.dumps(examples_val, ensure_ascii=False),
                    tags=tags_val if isinstance(tags_val, str) else json.dumps(tags_val, ensure_ascii=False),
                    source=kp_data.get('source', ''),
                    source_url=kp_data.get('source_url', ''),
                )
                db.session.add(kp)
                db.session.flush()
                kp_id_map[f"{ch_data['title']}::{kp_data['title']}"] = kp.id
                total_kps += 1

            for case_data in ch_data.get('teaching_cases', []):
                # Handle tags that may be pre-serialized string or native list
                case_tags = case_data.get('tags', [])
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
                    tags=case_tags if isinstance(case_tags, str) else json.dumps(case_tags, ensure_ascii=False),
                    source=case_data.get('source', ''),
                    source_url=case_data.get('source_url', ''),
                )
                db.session.add(case)
                total_cases += 1

            for ex_data in ch_data.get('exercises', []):
                correct_answer = ex_data['correct_answer']
                if not isinstance(correct_answer, str):
                    correct_answer = json.dumps(correct_answer, ensure_ascii=False)
                # Handle fields that may be pre-serialized strings or native Python objects
                ex_options = ex_data.get('options', [])
                ex_hints = ex_data.get('hints', [])
                ex_knowledge_tags = ex_data.get('knowledge_tags', [])
                exercise = CourseExercise(
                    course_id=course_id,
                    chapter_id=chapter.id,
                    title=ex_data['title'],
                    exercise_type=ex_data.get('exercise_type', 'choice'),
                    difficulty_level=ex_data.get('difficulty_level', 'intermediate'),
                    content=ex_data['content'],
                    options=ex_options if isinstance(ex_options, str) else json.dumps(ex_options, ensure_ascii=False),
                    correct_answer=correct_answer,
                    answer_analysis=ex_data.get('answer_analysis', ''),
                    hints=ex_hints if isinstance(ex_hints, str) else json.dumps(ex_hints, ensure_ascii=False),
                    knowledge_tags=ex_knowledge_tags if isinstance(ex_knowledge_tags, str) else json.dumps(ex_knowledge_tags, ensure_ascii=False),
                    score=ex_data.get('score', 5.0),
                    estimated_minutes=ex_data.get('estimated_minutes', 5),
                    source=ex_data.get('source', ''),
                    source_url=ex_data.get('source_url', ''),
                )
                db.session.add(exercise)
                total_exercises += 1

        db.session.commit()

        print(f"\n[Seed] ========== 数据入库完成 ==========")
        print(f"[Seed] 课程: {JAVA_COURSE_DATA['course']['title']}")
        print(f"[Seed] 章节: {len(chapter_id_map)} 个")
        print(f"[Seed] 知识点: {total_kps} 个")
        print(f"[Seed] 教学案例: {total_cases} 个")
        print(f"[Seed] 习题: {total_exercises} 个")
        print(f"[Seed] ======================================")


if __name__ == '__main__':
    seed_java_course()
