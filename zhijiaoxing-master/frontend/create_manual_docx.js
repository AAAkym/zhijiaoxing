const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
        Header, Footer, AlignmentType, PageOrientation, LevelFormat, HeadingLevel,
        TableOfContents, PageBreak, WidthType, ShadingType, BorderStyle,
        IndentCreate } = require('docx');
const fs = require('fs');
const path = require('path');

// 读取 Markdown 文件
const markdownContent = fs.readFileSync(path.join(__dirname, 'USAGE_MANUAL.md'), 'utf-8');

// 创建文档
const doc = new Document({
  creator: '智教星项目团队',
  title: '智教星 - 智能教学管理平台使用手册',
  description: '完整的项目使用指南，包括项目结构、快速开始和部署指南',
  styles: {
    default: {
      document: {
        run: { font: "Arial", size: 24, color: "000000" },
        paragraph: { spacing: { after: 200, line: 360, lineRule: "auto" } }
      }
    },
    paragraphStyles: [
      { 
        id: "Heading1", 
        name: "Heading 1", 
        basedOn: "Normal", 
        next: "Normal", 
        quickFormat: true,
        run: { size: 40, bold: true, font: "Arial", color: "1F4E78" },
        paragraph: { 
          spacing: { before: 400, after: 240 }, 
          outlineLevel: 0,
          pageBreakBefore: true
        }
      },
      { 
        id: "Heading2", 
        name: "Heading 2", 
        basedOn: "Normal", 
        next: "Normal", 
        quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 300, after: 200 }, outlineLevel: 1 }
      },
      { 
        id: "Heading3", 
        name: "Heading 3", 
        basedOn: "Normal", 
        next: "Normal", 
        quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "5B9BD5" },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 2 }
      },
      {
        id: "CodeBlock",
        name: "Code Block",
        basedOn: "Normal",
        next: "Normal",
        run: { 
          font: "Courier New", 
          size: 20,
          color: "000000"
        },
        paragraph: {
          spacing: { before: 120, after: 120 },
          style: {
            paragraph: {
              indent: { left: 720 }
            }
          }
        }
      },
      {
        id: "TableHeading",
        name: "Table Heading",
        basedOn: "Normal",
        run: { bold: true, size: 24, font: "Arial" },
        paragraph: { alignment: AlignmentType.CENTER }
      }
    ]
  },
  numbering: {
    config: [
      { 
        reference: "bullets",
        levels: [{ 
          level: 0, 
          format: LevelFormat.BULLET, 
          text: "•", 
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } 
        }] 
      },
      { 
        reference: "numbers",
        levels: [{ 
          level: 0, 
          format: LevelFormat.DECIMAL, 
          text: "%1.", 
          alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } 
        }] 
      },
    ]
  },
  sections: [{
    properties: {
      page: {
        size: { width: 12240, height: 15840 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
      }
    },
    headers: {
      default: new Header({
        children: [
          new Paragraph({
            children: [
              new TextRun({ 
                text: "智教星 - 智能教学管理平台使用手册", 
                size: 18, 
                italics: true,
                color: "666666"
              })
            ],
            alignment: AlignmentType.CENTER
          })
        ]
      })
    },
    footers: {
      default: new Footer({
        children: [
          new Paragraph({
            children: [
              new TextRun({ 
                text: "第 ", 
                size: 18,
                color: "666666"
              }),
              new TextRun({ 
                children: [PageNumber.CURRENT], 
                size: 18,
                color: "666666"
              }),
              new TextRun({ 
                text: " 页，共 ", 
                size: 18,
                color: "666666"
              }),
              new TextRun({ 
                children: [PageNumber.TOTAL_PAGES], 
                size: 18,
                color: "666666"
              }),
              new TextRun({ 
                text: " 页", 
                size: 18,
                color: "666666"
              })
            ],
            alignment: AlignmentType.CENTER
          })
        ]
      })
    },
    children: [
      // 封面
      new Paragraph({
        spacing: { before: 2000, after: 1000 },
        children: [
          new TextRun({ 
            text: "智教星", 
            size: 72, 
            bold: true, 
            font: "Arial",
            color: "1F4E78"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        spacing: { after: 500 },
        children: [
          new TextRun({ 
            text: "智能教学管理平台", 
            size: 48, 
            bold: true, 
            font: "Arial",
            color: "2E75B6"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        spacing: { after: 1000 },
        children: [
          new TextRun({ 
            text: "使用手册", 
            size: 56, 
            bold: true, 
            font: "Arial",
            color: "5B9BD5"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({ spacing: { after: 2000 } }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: "版本：1.0.0", 
            size: 24,
            color: "666666"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: "最后更新：2026 年 3 月 20 日", 
            size: 24,
            color: "666666"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: "适用版本：智教星 v1.0", 
            size: 24,
            color: "666666"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      new Paragraph({ spacing: { after: 3000 } }),
      new Paragraph({
        children: [
          new TextRun({ 
            text: "智教星项目团队", 
            size: 24,
            italics: true,
            color: "666666"
          })
        ],
        alignment: AlignmentType.CENTER
      }),
      
      new PageBreak(),
      
      // 目录
      new Paragraph({
        text: "目录",
        heading: HeadingLevel.HEADING_1,
        spacing: { after: 400 }
      }),
      new TableOfContents("目录", { 
        hyperlink: true, 
        headingStyleRange: "1-3",
        styles: [
          { level: 1, paragraph: { spacing: { after: 120 } } },
          { level: 2, paragraph: { spacing: { after: 80 } } },
          { level: 3, paragraph: { spacing: { after: 60 } } }
        ]
      }),
      
      new PageBreak(),
      
      // 第一章：项目结构
      new Paragraph({
        text: "一、项目结构",
        heading: HeadingLevel.HEADING_1
      }),
      
      new Paragraph({
        children: [
          new TextRun("智教星项目采用前后端分离的架构设计，项目结构清晰，模块划分合理。")
        ],
        spacing: { after: 240 }
      }),
      
      // 项目结构树
      new Paragraph({
        children: [
          new TextRun({ 
            text: "项目目录结构：", 
            bold: true 
          })
        ],
        spacing: { before: 240, after: 120 }
      }),
      
      new Paragraph({
        style: "CodeBlock",
        children: [
          new TextRun({ 
            text: `project_code/
├── backend/                          # 后端目录
│   ├── src/
│   │   ├── main.py                  # Flask 应用入口
│   │   ├── config.py                # 配置文件
│   │   ├── models/                  # 数据模型
│   │   ├── routes/                  # 路由控制器
│   │   └── services/                # 业务服务
│   ├── instance/dev.db              # SQLite 数据库
│   ├── .env                         # 环境变量配置
│   └── requirements.txt             # Python 依赖
│
├── frontend/                         # 前端目录
│   ├── src/
│   │   ├── App.jsx                  # 应用主组件
│   │   ├── components/              # React 组件
│   │   └── services/                # API 服务层
│   ├── .env                         # 环境变量
│   └── package.json                 # Node.js 依赖
│
└── README.md                        # 项目说明文档`,
            font: "Courier New",
            size: 18
          })
        ],
        spacing: { after: 400 }
      }),
      
      // 核心模块说明表格
      new Paragraph({
        children: [
          new TextRun({ 
            text: "核心模块说明：", 
            bold: true 
          })
        ],
        spacing: { before: 240, after: 120 }
      }),
      
      createModuleTable(),
      
      new PageBreak(),
      
      // 第二章：快速开始
      new Paragraph({
        text: "二、快速开始",
        heading: HeadingLevel.HEADING_1
      }),
      
      new Paragraph({
        text: "2.1 环境要求",
        heading: HeadingLevel.HEADING_2
      }),
      
      // 环境要求表格
      createEnvironmentTable(),
      
      new Paragraph({
        children: [
          new TextRun({ 
            text: "开发环境说明：", 
            bold: true 
          }),
          new TextRun(" 开发环境使用 SQLite，无需安装 PostgreSQL 和 Redis，开箱即用。")
        ],
        spacing: { after: 400 }
      }),
      
      new Paragraph({
        text: "2.2 后端启动",
        heading: HeadingLevel.HEADING_2
      }),
      
      // 后端启动步骤
      createBackendStartupSteps(),
      
      new Paragraph({
        text: "2.3 前端启动",
        heading: HeadingLevel.HEADING_2
      }),
      
      // 前端启动步骤
      createFrontendStartupSteps(),
      
      new Paragraph({
        text: "2.4 访问系统",
        heading: HeadingLevel.HEADING_2
      }),
      
      createAccessSystemSection(),
      
      new PageBreak(),
      
      // 第三章：部署指南
      new Paragraph({
        text: "三、部署指南",
        heading: HeadingLevel.HEADING_1
      }),
      
      new Paragraph({
        text: "3.1 生产环境准备",
        heading: HeadingLevel.HEADING_2
      }),
      
      createProductionPrepSection(),
      
      new Paragraph({
        text: "3.2 后端部署",
        heading: HeadingLevel.HEADING_2
      }),
      
      createBackendDeploymentSection(),
      
      new Paragraph({
        text: "3.3 前端部署",
        heading: HeadingLevel.HEADING_2
      }),
      
      createFrontendDeploymentSection(),
      
      new Paragraph({
        text: "3.4 Nginx 配置",
        heading: HeadingLevel.HEADING_2
      }),
      
      createNginxConfigSection(),
      
      new Paragraph({
        text: "3.5 常见问题",
        heading: HeadingLevel.HEADING_2
      }),
      
      createFAQSection(),
      
      new PageBreak(),
      
      // 附录
      new Paragraph({
        text: "附录",
        heading: HeadingLevel.HEADING_1
      }),
      
      new Paragraph({
        text: "A. 环境变量完整说明",
        heading: HeadingLevel.HEADING_2
      }),
      
      createEnvVarsTable(),
      
      new Paragraph({
        text: "B. API 接口文档",
        heading: HeadingLevel.HEADING_2
      }),
      
      createAPIDocsSection(),
      
      // 版本信息
      new PageBreak(),
      new Paragraph({
        text: "版本信息",
        heading: HeadingLevel.HEADING_2
      }),
      new Paragraph({
        children: [
          new TextRun("文档版本：1.0.0\n"),
          new TextRun("最后更新：2026 年 3 月 20 日\n"),
          new TextRun("适用版本：智教星 v1.0")
        ],
        spacing: { after: 400 }
      })
    ]
  }]
});

// 辅助函数：创建模块说明表格
function createModuleTable() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
  
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 7020],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("模块")] })],
            shading: { fill: "4472C4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("说明")] })],
            shading: { fill: "4472C4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 7020, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      // 后端模块
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "后端模块", bold: true })],
              alignment: AlignmentType.CENTER
            })],
            shading: { fill: "D6DCE4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "Flask + Python 3.11", bold: true })]
            })],
            shading: { fill: "D6DCE4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 7020, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("models/")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("数据库模型层，定义用户、课程、考核等数据结构")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 7020, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("routes/")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("API 路由层，处理 HTTP 请求和业务逻辑")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 7020, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("services/")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("业务服务层，封装 AI 调用、知识库等核心功能")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 7020, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      // 前端模块
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "前端模块", bold: true })],
              alignment: AlignmentType.CENTER
            })],
            shading: { fill: "D6DCE4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ 
              children: [new TextRun({ text: "React 19 + Vite", bold: true })]
            })],
            shading: { fill: "D6DCE4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 7020, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("components/")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("React 组件，包含三个角色的完整界面")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 7020, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("services/")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("API 服务层，统一封装后端接口调用")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 7020, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      })
    ]
  });
}

// 辅助函数：创建环境要求表格
function createEnvironmentTable() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
  
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [2340, 2340, 4680],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("软件")] })],
            shading: { fill: "4472C4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("版本要求")] })],
            shading: { fill: "4472C4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("用途")] })],
            shading: { fill: "4472C4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("Node.js")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("18+")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("前端开发环境")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("Python")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("3.11+")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("后端运行环境")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("pnpm")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("10.4.1+")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 2340, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("前端包管理器，推荐使用")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      })
    ]
  });
}

// 辅助函数：创建后端启动步骤
function createBackendStartupSteps() {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    children: [
      new TextRun("进入后端目录：cd backend\n"),
      new TextRun("创建虚拟环境：python -m venv venv\n"),
      new TextRun("安装依赖：pip install -r requirements.txt\n"),
      new TextRun("配置环境变量：编辑 backend/.env 文件\n"),
      new TextRun("初始化数据库：python src/init_db.py\n"),
      new TextRun("启动服务：python src/main.py")
    ],
    spacing: { after: 400 }
  });
}

// 辅助函数：创建前端启动步骤
function createFrontendStartupSteps() {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    children: [
      new TextRun("进入前端目录：cd frontend\n"),
      new TextRun("安装依赖：pnpm install\n"),
      new TextRun("配置环境变量：编辑 frontend/.env 文件\n"),
      new TextRun("启动服务：pnpm run dev")
    ],
    spacing: { after: 400 }
  });
}

// 辅助函数：创建访问系统部分
function createAccessSystemSection() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
  
  return new Paragraph({
    children: [
      new TextRun("浏览器访问："),
      new TextRun({ 
        text: "http://localhost:5173", 
        bold: true,
        color: "0066CC"
      }),
      new TextRun("\n\n默认账号：\n"),
      new TextRun({ text: "管理员：admin / admin123\n", bold: true }),
      new TextRun({ text: "教师：teacher / teacher123\n", bold: true }),
      new TextRun({ text: "学生：student / student123", bold: true })
    ],
    spacing: { after: 400 }
  });
}

// 辅助函数：创建生产环境准备部分
function createProductionPrepSection() {
  return new Paragraph({
    children: [
      new TextRun("系统要求：\n"),
      new TextRun({ text: "操作系统：Linux (Ubuntu 20.04+ / CentOS 7+)\n", bold: true }),
      new TextRun({ text: "CPU：2 核+\n", bold: true }),
      new TextRun({ text: "内存：4GB+\n", bold: true }),
      new TextRun({ text: "存储：20GB+", bold: true })
    ],
    spacing: { after: 400 }
  });
}

// 辅助函数：创建后端部署部分
function createBackendDeploymentSection() {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    children: [
      new TextRun("准备 PostgreSQL 数据库\n"),
      new TextRun("配置环境变量：编辑 backend/.env.production\n"),
      new TextRun("安装 Python 依赖：pip install -r requirements.txt\n"),
      new TextRun("初始化数据库：python3 src/init_db.py\n"),
      new TextRun("使用 Gunicorn 启动：gunicorn -w 4 -b 0.0.0.0:5000 src.main:app\n"),
      new TextRun("配置 Systemd 服务（可选）")
    ],
    spacing: { after: 400 }
  });
}

// 辅助函数：创建前端部署部分
function createFrontendDeploymentSection() {
  return new Paragraph({
    numbering: { reference: "numbers", level: 0 },
    children: [
      new TextRun("构建生产版本：pnpm run build\n"),
      new TextRun("配置生产环境变量：编辑 frontend/.env.production\n"),
      new TextRun("部署静态文件到 Nginx 目录\n"),
      new TextRun("使用 PM2 部署（可选）")
    ],
    spacing: { after: 400 }
  });
}

// 辅助函数：创建 Nginx 配置部分
function createNginxConfigSection() {
  return new Paragraph({
    children: [
      new TextRun("Nginx 配置文件位置："),
      new TextRun({ 
        text: "/etc/nginx/sites-available/zhijiaoxing\n\n", 
        font: "Courier New",
        size: 20
      }),
      new TextRun("主要配置项：\n"),
      new TextRun({ text: "前端静态文件代理\n", bold: true }),
      new TextRun({ text: "后端 API 反向代理\n", bold: true }),
      new TextRun({ text: "视频文件代理\n", bold: true }),
      new TextRun({ text: "Gzip 压缩优化\n", bold: true }),
      new TextRun({ text: "HTTPS 配置（Let's Encrypt）", bold: true })
    ],
    spacing: { after: 400 }
  });
}

// 辅助函数：创建常见问题部分
function createFAQSection() {
  const faqs = [
    "后端启动失败，提示数据库连接错误",
    "前端无法连接后端 API",
    "AI 功能无法使用",
    "静态文件 404",
    "数据库迁移问题",
    "Redis 连接失败",
    "端口被占用"
  ];
  
  return new Paragraph({
    children: faqs.map((faq, index) => 
      new TextRun({ 
        text: `${index + 1}. ${faq}\n`, 
        bold: index === 0 // 第一个加粗示例
      })
    ),
    spacing: { after: 400 }
  });
}

// 辅助函数：创建环境变量表格
function createEnvVarsTable() {
  const border = { style: BorderStyle.SINGLE, size: 1, color: "000000" };
  
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [3120, 4680, 1560],
    rows: [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("变量名")] })],
            shading: { fill: "4472C4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 3120, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("说明")] })],
            shading: { fill: "4472C4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("必填")] })],
            shading: { fill: "4472C4", type: ShadingType.CLEAR },
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 1560, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("DATABASE_URL")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 3120, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("数据库连接字符串")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("否")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 1560, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("SPARK_API_PASSWORD")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 3120, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("Spark API 密码")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 4680, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun("是")] })],
            borders: { top: border, bottom: border, left: border, right: border },
            width: { size: 1560, type: WidthType.DXA },
            margins: { top: 80, bottom: 80, left: 120, right: 120 }
          })
        ]
      })
    ]
  });
}

// 辅助函数：创建 API 文档部分
function createAPIDocsSection() {
  return new Paragraph({
    children: [
      new TextRun({ text: "认证接口：", bold: true }),
      new TextRun(" POST /api/login, POST /api/register, POST /api/logout\n\n"),
      new TextRun({ text: "课程接口：", bold: true }),
      new TextRun(" GET/POST/PUT/DELETE /api/courses\n\n"),
      new TextRun({ text: "AI 接口：", bold: true }),
      new TextRun(" POST /api/ai_chat, POST /api/generate_content")
    ],
    spacing: { after: 400 }
  });
}

// 生成文档
Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync(path.join(__dirname, '智教星使用手册.docx'), buffer);
  console.log('文档生成成功！');
}).catch(error => {
  console.error('生成文档时出错:', error);
  process.exit(1);
});
