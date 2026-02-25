---
description: 計画テンプレートを使用して実装計画ワークフローを実行し、設計アーティファクトを生成します。
handoffs: 
  - label: タスクを作成
    agent: speckit.tasks
    prompt: 計画をタスクに分解
    send: true
  - label: チェックリストを作成
    agent: speckit.checklist
    prompt: 次のドメインのチェックリストを作成...
---

## ユーザー入力

```text
$ARGUMENTS
```

提供されたユーザー入力を必ず検討してから進めてください（空でない場合）。

## 概要

1. **セットアップ**：リポジトリルートから `.specify/scripts/bash/setup-plan.sh --json` を実行し、FEATURE_SPEC、IMPL_PLAN、SPECS_DIR、BRANCHのJSONを解析します。「I'm Groot」などの引数内の単一引用符については、エスケープ構文を使用：例：'I'\''m Groot'（または可能な場合は二重引用符：「I'm Groot」）。

2. **コンテキストをロード**：FEATURE_SPECと`.specify/memory/constitution.md`を読み込みます。IMPL_PLANテンプレート（既にコピーされた）をロードします。

3. **計画ワークフローを実行**：IMPL_PLANテンプレートの構造に従って：
   - 技術的コンテキストを埋める（未知は「NEEDS CLARIFICATION」としてマーク）
   - 憲法から憲法チェックセクションを埋める
   - ゲートを評価（未正当化の違反でエラー）
   - フェーズ0：research.mdを生成（すべてのNEEDS CLARIFICATIONを解決）
   - フェーズ1：data-model.md、contracts/、quickstart.mdを生成
   - フェーズ1：エージェントスクリプトを実行してコンテキストを更新
   - 設計後憲法チェックを再評価

4. **停止して報告**：コマンドはフェーズ2計画後に終了します。ブランチ、IMPL_PLANパス、生成されたアーティファクトを報告します。

## フェーズ

### フェーズ0：概要とリサーチ

1. **技術的コンテキストから未知を抽出**：
   - 各NEEDS CLARIFICATION → リサーチタスク
   - 各依存関係 → ベストプラクティスタスク
   - 各統合 → パターンタスク

2. **リサーチエージェントを生成して派遣**：

   ```text
   技術的コンテキストの各未知について：
     タスク："Research {unknown} for {feature context}"
   各技術選択について：
     タスク："Find best practices for {tech} in {domain}"
   ```

3. **research.mdで検出結果を統合**：
   - 決定：[何が選ばれたか]
   - 理由：[なぜ選ばれたか]
   - 検討された代替案：[他に何か評価されたか]

**出力**：すべてのNEEDS CLARIFICATIONが解決されたresearch.md

### フェーズ1：設計と契約

**前提条件**：`research.md` 完了

1. **機能仕訳からエンティティを抽出** → `data-model.md`：
   - 機能名、フィールド、関係
   - 要件からの検証ルール
   - 適用可能な場合の状態遷移

2. **インターフェース契約を定義**（プロジェクトに外部インターフェースがある場合） → `/contracts/`：
   - プロジェクトが公開するインターフェースを特定
   - プロジェクトタイプに適した契約形式を文書化
   - 例：ライブラリ用パブリックAPI、CLIツール用コマンドスキーマ、ウェブサービス用のエンドポイント、パーサー用の文法、アプリケーション用のUI契約
   - プロジェクトが純粋に内部の場合（ビルドスクリプト、ワンオフツールなど）スキップ

3. **エージェントコンテキストの更新**：
   - `.specify/scripts/bash/update-agent-context.sh copilot` を実行
   - これらのスクリプトはどのAIエージェントが使用されているかを検出します
   - 適切なエージェント固有のコンテキストファイルを更新
   - 現在の計画からのみ新しい技術を追加
   - マーカー間での手動追加を保持

**出力**：data-model.md、/contracts/*、quickstart.md、エージェント固有ファイル

## 重要なルール

- 絶対パスを使用
- ゲート失敗または未解決なNEEDS CLARIFICATIONでエラー
