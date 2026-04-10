const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, LevelFormat,
        TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
        PageNumber } = require('docx');
const fs = require('fs');

console.log("开始生成 Word 文档...");

// 定义样式
const styles = {
  default: {
    document: {
      run: {
        font: "Arial",
        size: 24,
        color: "000000"
      },
      paragraph: {
        spacing: {
          line: 360,
          after: 120
        }
      }
    }
  },
  paragraphStyles: [
    {
      id: "Heading1",
      name: "Heading 1",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "黑体", size: 32, bold: true, color: "000000" },
      paragraph: { spacing: { before: 240, after: 240, line: 360 }, outlineLevel: 0 }
    },
    {
      id: "Heading2",
      name: "Heading 2",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "黑体", size: 28, bold: true, color: "000000" },
      paragraph: { spacing: { before: 180, after: 180, line: 360 }, outlineLevel: 1 }
    },
    {
      id: "Heading3",
      name: "Heading 3",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "黑体", size: 24, bold: true, color: "000000" },
      paragraph: { spacing: { before: 120, after: 120, line: 360 }, outlineLevel: 2 }
    },
    {
      id: "Title",
      name: "Title",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "黑体", size: 44, bold: true, color: "000000" },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 200, after: 200, line: 360 } }
    },
    {
      id: "Subtitle",
      name: "Subtitle",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "仿宋", size: 32, color: "404040" },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 100, after: 300, line: 360 } }
    },
    {
      id: "MetaInfo",
      name: "Meta Info",
      basedOn: "Normal",
      next: "Normal",
      quickFormat: true,
      run: { font: "仿宋", size: 24, color: "404040" },
      paragraph: { alignment: AlignmentType.CENTER, spacing: { before: 60, after: 60, line: 360 } }
    }
  ]
};

// 编号样式
const numbering = {
  config: [
    {
      reference: "bullets",
      levels: [{
        level: 0,
        format: LevelFormat.BULLET,
        text: "•",
        alignment: AlignmentType.LEFT,
        style: {
          paragraph: {
            indent: { left: 720, hanging: 360 }
          }
        }
      }]
    }
  ]
};

// 页眉
const header = new Header({
  children: [
    new Paragraph({
      children: [
        new TextRun({ text: "智教星 - 智能教学管理平台", color: "808080", size: 18 })
      ],
      alignment: AlignmentType.LEFT
    })
  ]
});

// 页脚
const footer = new Footer({
  children: [
    new Paragraph({
      children: [
        new TextRun({ text: "项目开发文档  |  第 ", color: "808080", size: 18 }),
        new TextRun({ children: [PageNumber.CURRENT], color: "808080", size: 18 }),
        new TextRun({ text: " 页", color: "808080", size: 18 })
      ],
      alignment: AlignmentType.CENTER
    })
  ]
});

// 封面内容
const coverChildren = [
  new Paragraph({ spacing: { before: 2000 } }),
  new Paragraph({
    heading: HeadingLevel.TITLE,
    children: [
      new TextRun({ text: "智教星", font: "黑体", size: 44, bold: true }),
      new TextRun({ text: "\n智能教学管理平台", font: "黑体", size: 44, bold: true })
    ]
  }),
  new Paragraph({
    heading: "Subtitle",
    children: [new TextRun("项目开发文档")]
  }),
  new Paragraph({ spacing: { before: 1000 } }),
  new Paragraph({ heading: "MetaInfo", children: [new TextRun("文档版本：V1.0")] }),
  new Paragraph({ heading: "MetaInfo", children: [new TextRun("编制日期：2026 年 4 月 5 日")] }),
  new Paragraph({ heading: "MetaInfo", children: [new TextRun("编制单位：项目开发团队")] }),
  new Paragraph({ spacing: { before: 3000 } }),
  new Paragraph({
    children: [new TextRun({ text: "© 2026 项目开发团队。保留所有权利。", font: "仿宋", size: 20, color: "808080" })],
    alignment: AlignmentType.CENTER
  })
];

// 目录页内容
const tocChildren = [
  new Paragraph({ pageBreakBefore: true }),
  new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun("目录")],
    spacing: { before: 0, after: 400 }
  }),
  new TableOfContents("目录", { hyperlink: true, headingStyleRange: "1-3" })
];

// 正文内容构建函数
function createContentSections() {
  const sections = [];
  
  // 第 1 章：项目概述
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("1. 项目概述")] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.1 项目背景")] }),
    new Paragraph({ children: [new TextRun("随着人工智能技术的快速发展，教育行业正经历着深刻的数字化转型。传统教学管理模式面临着教学资源分配不均、个性化学习支持不足、师生互动效率低下等挑战。")] }),
    new Paragraph({ children: [new TextRun("本项目基于 Spark4.0 Ultra 星火大模型，采用现代化的前后端分离架构，为管理员、教师和学生提供全方位的 AI 辅助教学服务。")] }),
    
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("1.2 项目目标")] }),
    new Paragraph({ children: [new TextRun("构建一个功能完善、性能优异、安全可靠的智能教学管理平台。")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("管理效率提升：为管理员提供完善的用户管理、课程管理和数据分析功能")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("教学质量改善：为教师提供 AI 辅助内容生成、智能出题和学情分析功能")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("学习体验优化：为学生提供个性化学习路径、智能答疑和错题管理功能")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("数据驱动决策：通过多维度数据分析和可视化展示，为教学决策提供科学依据")] })
  );
  
  // 第 2 章：系统架构
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("2. 系统架构")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.1 总体架构")] }),
    new Paragraph({ children: [new TextRun("系统采用前后端分离的微服务架构，分为前端层、后端层、数据层三层架构。")] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("2.2 技术架构特点")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("前后端分离：前端负责 UI，后端负责业务逻辑")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("微服务化设计：认证服务、课程服务、AI 服务、互动服务、数据服务")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("异步任务处理：使用 Celery 处理耗时任务，Redis 作为消息队列")] })
  );
  
  // 第 3 章：技术栈选型
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("3. 技术栈选型")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.1 前端技术栈")] })
  );
  
  // 前端技术栈表格
  const frontendTable = createTable(
    ["技术", "版本", "用途", "选型理由"],
    [
      ["React", "19", "UI 框架", "组件化开发、生态丰富、性能优异"],
      ["Vite", "6", "构建工具", "极速启动、热更新、现代化构建"],
      ["Tailwind CSS", "4", "样式框架", "原子化 CSS、开发效率高"],
      ["shadcn/ui", "Latest", "UI 组件库", "美观、可定制、基于 Tailwind"],
      ["React Router", "7", "路由管理", "官方推荐、功能完善"]
    ]
  );
  sections.push(frontendTable);
  
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("3.2 后端技术栈")] })
  );
  
  // 后端技术栈表格
  const backendTable = createTable(
    ["技术", "版本", "用途", "选型理由"],
    [
      ["Flask", "3.0", "Web 框架", "轻量级、灵活、易于扩展"],
      ["Python", "3.11+", "编程语言", "AI 生态丰富、开发效率高"],
      ["Flask-SQLAlchemy", "3.1", "ORM 框架", "功能强大、支持多种数据库"],
      ["PostgreSQL", "15+", "数据库（生产）", "性能优异、功能强大"],
      ["Celery", "5.3", "异步任务", "分布式、支持多种消息队列"],
      ["Redis", "5.0", "缓存/消息队列", "高性能、支持多种数据结构"]
    ]
  );
  sections.push(backendTable);
  
  // 第 4 章：开发环境配置
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("4. 开发环境配置")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.1 系统要求")] }),
    new Paragraph({ children: [new TextRun("操作系统：Windows 10/11、macOS 12+、Linux（Ubuntu 20.04+）")] }),
    new Paragraph({ children: [new TextRun("硬件要求：CPU 4 核以上，内存 8GB 以上，硬盘 50GB 可用空间")] }),
    new Paragraph({ children: [new TextRun("软件要求：Python 3.11+、Node.js 18+、npm 9+ 或 pnpm 8+、Git 2.30+")] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.2 后端配置")] }),
    new Paragraph({ children: [new TextRun("创建虚拟环境并安装依赖：pip install -r requirements.txt")] }),
    new Paragraph({ children: [new TextRun("配置环境变量：DATABASE_URL、SPARK_API_KEY、SPARK_API_SECRET 等")] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("4.3 前端配置")] }),
    new Paragraph({ children: [new TextRun("安装依赖：pnpm install")] }),
    new Paragraph({ children: [new TextRun("配置环境变量：VITE_API_BASE_URL=http://localhost:5000/api")] }),
    new Paragraph({ children: [new TextRun("启动开发服务器：pnpm run dev")] })
  );
  
  // 第 5 章：功能模块设计
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("5. 功能模块设计")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.1 管理员平台")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("用户管理：添加、删除、修改用户信息，分配角色和权限")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("课程管理：创建课程、分配教师、设置课程状态")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("数据分析：用户增长趋势、课程活跃度、学习进度统计")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("系统设置：基础配置、AI 模型配置、安全策略")] }),
    
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.2 教师平台")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("课程管理：创建和管理课程、学生管理、资源上传")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("AI 内容生成：自动生成教学内容、练习题和解析")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("考核管理：AI 智能出题、考试管理、成绩统计")] }),
    
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("5.3 学生平台")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("我的课程：查看已选修课程、学习进度追踪")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("AI 学习助手：24/7 智能答疑、多轮对话")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("练习评测：在线练习、自动批改、错题本")] })
  );
  
  // 第 6 章：API 接口规范
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("6. API 接口规范")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.1 设计原则")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("RESTful 风格设计")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("使用标准 HTTP 方法（GET/POST/PUT/DELETE）")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("统一返回格式（code/data/message）")] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("6.2 核心接口")] })
  );
  
  const apiTable = createTable(
    ["接口", "方法", "描述"],
    [
      ["/api/auth/login", "POST", "用户登录"],
      ["/api/auth/logout", "POST", "用户登出"],
      ["/api/users", "GET", "获取用户列表"],
      ["/api/courses", "GET", "获取课程列表"],
      ["/api/courses", "POST", "创建课程"]
    ]
  );
  sections.push(apiTable);
  
  // 第 7 章：数据库设计
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("7. 数据库设计")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.1 数据库选型")] }),
    new Paragraph({ children: [new TextRun("开发环境使用 SQLite，生产环境使用 PostgreSQL，通过 SQLAlchemy ORM 实现数据库抽象。")] }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("7.2 核心数据表")] })
  );
  
  const dbTable = createTable(
    ["表名", "描述", "主要字段"],
    [
      ["users", "用户表", "id, username, password_hash, email, role, real_name"],
      ["courses", "课程表", "id, title, description, teacher_id, category, difficulty"],
      ["student_courses", "学生课程关联表", "id, student_id, course_id, enrolled_at, progress"]
    ]
  );
  sections.push(dbTable);
  
  // 第 8-13 章
  sections.push(
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("8. 开发流程与规范")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("8.1 Git 工作流")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("采用 Git Flow 分支管理策略")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("main：生产环境分支，保持稳定")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("develop：开发主分支")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("feature/*：功能分支")] }),
    
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("9. 测试策略")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("9.1 测试层次")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("单元测试：前端 Jest + React Testing Library，后端 Pytest，覆盖率 80%+")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("集成测试：API 接口测试、数据库操作测试")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("端到端测试：Playwright 浏览器自动化测试")] }),
    
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("10. 部署方案")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("10.1 部署架构")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("前端：Nginx 静态文件服务器")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("后端：Gunicorn + Flask 应用服务器")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("数据库：PostgreSQL 主从复制")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("缓存：Redis 集群")] }),
    
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("11. 项目进度计划")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("11.1 项目阶段")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("第一阶段：需求分析与设计（2 周）")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("第二阶段：核心功能开发（6 周）")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("第三阶段：功能完善（4 周）")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("第四阶段：测试与部署（2 周）")] }),
    
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("12. 风险评估与应对措施")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("12.1 技术风险")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("AI 服务稳定性：实现重试机制和降级策略")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("性能瓶颈：数据库查询优化，Redis 缓存，负载均衡")] }),
    
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("13. 附录")], pageBreakBefore: true }),
    new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun("13.1 参考资料")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("React 官方文档：https://react.dev")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("Flask 官方文档：https://flask.palletsprojects.com")] }),
    new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun("讯飞星火 API 文档：https://www.xfyun.cn/doc/spark")] })
  );
  
  return sections;
}

// 创建表格的辅助函数
function createTable(headers, rows) {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
  const borders = { top: border, bottom: border, left: border, right: border };
  
  const tableRows = [
    new TableRow({
      tableHeader: true,
      children: headers.map(header =>
        new TableCell({
          borders,
          shading: { fill: "D5E8F0", type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [
            new Paragraph({
              children: [new TextRun({ text: header, bold: true })]
            })
          ]
        })
      )
    })
  ];
  
  rows.forEach(row => {
    tableRows.push(
      new TableRow({
        children: row.map(cell =>
          new TableCell({
            borders,
            margins: { top: 80, bottom: 80, left: 120, right: 120 },
            children: [
              new Paragraph({
                children: [new TextRun(cell)]
              })
            ]
          })
        )
      })
    );
  });
  
  const columnWidths = headers.map(() => Math.floor(9360 / headers.length));
  
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths,
    rows: tableRows
  });
}

// 创建文档
const doc = new Document({
  creator: "项目开发团队",
  title: "智教星 - 智能教学管理平台项目开发文档",
  description: "全面、专业的项目开发文档",
  styles,
  numbering,
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: { default: header },
      footers: { default: footer },
      children: [...coverChildren, ...tocChildren, ...createContentSections()]
    }
  ]
});

console.log("文档结构已创建，正在生成文件...");

// 生成文档
Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync("c:/Users/33552/Desktop/project_code/智教星项目开发文档.docx", buffer);
  console.log("✓ 文档生成成功！");
  console.log("文件位置：c:/Users/33552/Desktop/project_code/智教星项目开发文档.docx");
}).catch((err) => {
  console.error("✗ 文档生成失败:", err);
  process.exit(1);
});
