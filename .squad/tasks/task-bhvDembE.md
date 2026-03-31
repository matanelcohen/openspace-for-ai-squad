---
id: task-bhvDembE
title: Audit and sanitize user input rendering across frontend
status: pending
priority: P1
assignee: fry
labels:
  - security
  - frontend
  - xss
  - 'parent:task-F50-qNqa'
created: '2026-03-31T08:10:40.748Z'
updated: '2026-03-31T08:10:40.748Z'
sortIndex: 278
---
Review all places where user-generated content (task titles, descriptions, labels) is rendered in the UI. Ensure React's default escaping is not bypassed (e.g., no dangerouslySetInnerHTML with unsanitized input). Verify that special characters like <, >, ", and ' render correctly as text, not as HTML.
