# Product Roadmap

> **PDF Content Extractor & Translator** — Feature Development Timeline

---

## Roadmap Overview

```mermaid
gantt
    title PDF Extractor Feature Roadmap (2025)
    dateFormat  YYYY-MM-DD
    
    section v1.0 (Current)
    Core Extraction Engine       :done, v1-core, 2025-01-01, 2025-06-01
    PDF Editor (Annotations)     :done, v1-editor, 2025-03-01, 2025-08-01
    Local AI Chat               :done, v1-ai, 2025-06-01, 2025-10-01
    Merge/Split/Compress        :done, v1-tools, 2025-08-01, 2025-11-01
    Compare PDFs                :done, v1-compare, 2025-10-01, 2025-12-01
    v1.0 Release                :milestone, v1-release, 2025-12-15, 0d
    
    section v1.1 (Q1 2026)
    PDF/A Compliance            :active, v11-pdfa, 2025-12-20, 2026-01-15
    Batch Translation           :v11-batch, 2026-01-01, 2026-01-31
    OCR Enhancement             :v11-ocr, 2026-01-15, 2026-02-15
    Custom Fonts                :v11-fonts, 2026-02-01, 2026-02-28
    v1.1 Release                :milestone, v11-release, 2026-03-01, 0d
    
    section v1.2 (Q2 2026)
    Form Filling                :v12-forms, 2026-03-01, 2026-04-15
    Password Protection         :v12-password, 2026-03-15, 2026-04-30
    Crop PDF                    :v12-crop, 2026-04-01, 2026-05-01
    v1.2 Release                :milestone, v12-release, 2026-05-15, 0d
    
    section v2.0 (Future)
    Plugin Architecture         :v2-plugins, 2026-06-01, 2026-09-01
    PWA Mobile App              :v2-pwa, 2026-07-01, 2026-12-01
    Enterprise SSO              :v2-sso, 2026-09-01, 2026-12-01
```

---

## Current Release: v1.0 ✅

**Status:** Released | **Date:** December 2025

### Shipped Features

| Category        | Feature              | Description                              |
| --------------- | -------------------- | ---------------------------------------- |
| **Extraction**  | Full Document → Word | PDF to .docx with structure preservation |
| **Extraction**  | Table → CSV          | Detect and export tables                 |
| **Extraction**  | Table → Word         | Tables in document format                |
| **Translation** | Offline Translation  | 9 languages via Argos Translate          |
| **Editor**      | Text Annotations     | Add text anywhere on PDF                 |
| **Editor**      | Highlight/Redact     | Markup and redaction tools               |
| **Editor**      | Shapes               | Rectangle, ellipse, line, arrow          |
| **Editor**      | Digital Signature    | Draw, type, or upload signatures         |
| **Editor**      | Sticky Notes         | Comment annotations                      |
| **Pages**       | Insert/Delete/Rotate | Full page manipulation                   |
| **Pages**       | Reorder              | Drag-and-drop page ordering              |
| **Tools**       | Merge PDFs           | Combine multiple documents               |
| **Tools**       | Split PDF            | Extract page ranges                      |
| **Tools**       | Compress             | Reduce file size                         |
| **Tools**       | Compare PDFs         | Visual diff between documents            |
| **Tools**       | Repair PDF           | Fix corrupted files                      |
| **Convert**     | PDF to JPG           | Export pages as images                   |
| **Protect**     | Watermark            | Add text watermarks                      |
| **AI**          | Local Chat           | Q&A via Ollama                           |
| **AI**          | Document Indexing    | RAG-based retrieval                      |

---

## Next Release: v1.1 📋

**Status:** In Development | **Target:** Q1 2026

### Planned Features

```mermaid
flowchart LR
    subgraph "v1.1 Features"
        A[PDF/A Compliance]
        B[Batch Translation]
        C[OCR Enhancement]
        D[Custom Fonts]
        E[Language Detection]
        F[Conversation History]
    end
    
    subgraph "Dependencies"
        A --> G[Ghostscript Update]
        C --> H[Tesseract 5.x]
        F --> I[Session Storage]
    end
```

| Feature                  | Priority | Description                                          | Effort |
| ------------------------ | -------- | ---------------------------------------------------- | ------ |
| **PDF/A Compliance**     | P1       | Convert PDFs to archival format (PDF/A-1b, PDF/A-2b) | 4 pts  |
| **Batch Translation**    | P1       | Translate multiple documents in one operation        | 3 pts  |
| **OCR Enhancement**      | P1       | Improve text layer quality for scanned PDFs          | 3 pts  |
| **Custom Fonts**         | P1       | Upload custom fonts for annotations                  | 2 pts  |
| **Language Detection**   | P1       | Auto-detect source language for translation          | 2 pts  |
| **Conversation History** | P1       | Persist AI chat across sessions                      | 2 pts  |

### v1.1 Success Criteria

| Metric                        | Target         |
| ----------------------------- | -------------- |
| PDF/A validation pass rate    | 95%+           |
| Batch processing throughput   | 10 docs/minute |
| OCR accuracy improvement      | +15% vs v1.0   |
| User font upload success rate | 99%+           |

---

## Future Release: v1.2 📋

**Status:** Planned | **Target:** Q2 2026

### Planned Features

| Feature                 | Priority | Description                            | Effort |
| ----------------------- | -------- | -------------------------------------- | ------ |
| **Form Filling**        | P1       | Fill interactive PDF forms (AcroForms) | 5 pts  |
| **Password Protection** | P1       | Add/remove PDF passwords               | 3 pts  |
| **Crop PDF**            | P1       | Remove margins and unwanted areas      | 3 pts  |
| **Page Numbers**        | P2       | Add automatic page numbering           | 2 pts  |
| **Bates Stamping**      | P2       | Legal document numbering               | 3 pts  |

---

## Long-Term Vision: v2.0 🔮

**Status:** Exploration | **Target:** 2026-2027

### Strategic Initiatives

```mermaid
mindmap
  root((v2.0 Vision))
    Extensibility
      Plugin Architecture
      Custom Tool SDK
      Third-party Integrations
    Mobile
      PWA Application
      Responsive Redesign
      Offline-first Mobile
    Enterprise
      SSO Integration
      Audit Logging
      Role-based Access
      Multi-tenant Support
    AI Evolution
      Multi-model Support
      Fine-tuned Models
      Agentic Workflows
```

| Initiative              | Description                    | Business Value                   |
| ----------------------- | ------------------------------ | -------------------------------- |
| **Plugin Architecture** | Allow third-party extensions   | Ecosystem growth, customization  |
| **PWA Mobile App**      | Progressive Web App for mobile | Broader reach, mobile users      |
| **Enterprise SSO**      | SAML/OIDC integration          | Enterprise sales enablement      |
| **Multi-model AI**      | Support multiple LLM providers | Flexibility, vendor independence |

---

## Feature Prioritization Matrix

```mermaid
quadrantChart
    title Feature Priority Matrix
    x-axis Low Effort --> High Effort
    y-axis Low Value --> High Value
    quadrant-1 "Do First"
    quadrant-2 "Plan Carefully"
    quadrant-3 "Deprioritize"
    quadrant-4 "Quick Wins"
    
    "PDF/A Compliance": [0.5, 0.8]
    "Batch Translation": [0.3, 0.75]
    "Form Filling": [0.7, 0.85]
    "Custom Fonts": [0.25, 0.5]
    "Crop PDF": [0.35, 0.55]
    "Plugin Architecture": [0.9, 0.9]
    "PWA Mobile": [0.95, 0.7]
    "Enterprise SSO": [0.8, 0.6]
    "Bates Stamping": [0.4, 0.45]
    "Language Detection": [0.2, 0.65]
```

---

## Competitive Gap Closure

### Current Status vs iLovePDF

| Feature                 | iLovePDF | Us (v1.0) | Us (v1.2) | Gap Status        |
| ----------------------- | -------- | --------- | --------- | ----------------- |
| Merge PDF               | ✅        | ✅         | ✅         | Closed            |
| Split PDF               | ✅        | ✅         | ✅         | Closed            |
| Compress                | ✅        | ✅         | ✅         | Closed            |
| Shapes                  | ✅        | ✅         | ✅         | Closed            |
| Digital Signature       | ✅        | ✅         | ✅         | Closed            |
| Watermark               | ✅        | ✅         | ✅         | Closed            |
| Compare PDFs            | ✅        | ✅         | ✅         | Closed            |
| PDF/A                   | ✅        | ❌         | ✅         | **v1.1**          |
| Crop PDF                | ✅        | ❌         | ✅         | **v1.2**          |
| Form Filling            | ✅        | ❌         | ✅         | **v1.2**          |
| Password Protection     | ✅        | ❌         | ✅         | **v1.2**          |
| **Offline Translation** | ❌        | ✅         | ✅         | **Our Advantage** |
| **Local AI Chat**       | ❌        | ✅         | ✅         | **Our Advantage** |
| **Self-Hosted**         | ❌        | ✅         | ✅         | **Our Advantage** |

---

## Release Cadence

| Release           | Cycle     | Focus                               |
| ----------------- | --------- | ----------------------------------- |
| **Patch (x.x.1)** | As needed | Bug fixes, security patches         |
| **Minor (x.1.0)** | Quarterly | New features, improvements          |
| **Major (2.0.0)** | Annually  | Breaking changes, major initiatives |

---

## How to Contribute

Want to help build these features? 

1. Check the [GitHub Issues](https://github.com/matis-dev/pdf-extractor-translator/issues) for open tasks
2. Read [CONTRIBUTING.md](../CONTRIBUTING.md) for guidelines
3. Discuss new ideas in [GitHub Discussions](https://github.com/matis-dev/pdf-extractor-translator/discussions)

---

*Roadmap last updated: 2025-12-20*
