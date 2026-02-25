---
description: 既存のタスクを、利用可能な設計アーティファクトに基づいて実行可能なGitHubイシューの依存関係順に変換します。
tools: ['github/github-mcp-server/issue_write']
---

## ユーザー入力

```text
$ARGUMENTS
```

提供されたユーザー入力を必ず検討してから進めてください（空でない場合）。

## 概要

1. リポジトリルートから `.specify/scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks` を実行し、FEATURE_DIRとAVAILABLE_DOCSリストを解析します。すべてのパスは絶対パスである必要があります。「I'm Groot」などの引数内の単一引用符については、エスケープ構文を使用：例：'I'\''m Groot'（または可能な場合は二重引用符：「I'm Groot」）。
1. 実行されたスクリプトから、**tasks** へのパスを抽出します。
1. Gitリモートを実行して取得：

```bash
git config --get remote.origin.url
```

> [!CAUTION]
> リモートがGitHub URLの場合のみ次のステップに進む

1. リストの各タスクについて、GitHub MCPサーバーを使用して、Gitリモートを表すリポジトリにこの機能的に同等のイシューを新規作成します。

> [!CAUTION]
> いかなる状況でリモートURLと一致しないリポジトリにイシューを作成しない
