# R2ABENCH View Evaluation

Static GitHub Pages site for R2ABench human review calibration.

## Open The Review Site

After GitHub Pages is enabled, the site URL is:

```text
https://homehappily.github.io/R2ABENCH-_view_evaluation/
```

Use reviewer/session query parameters to separate annotations:

```text
https://homehappily.github.io/R2ABENCH-_view_evaluation/?reviewer=alice&session=pilot-01
```

## Annotation Workflow

1. Open the site URL.
2. Set a unique reviewer id and session id.
3. Review each candidate architecture against the reference.
4. Export JSON or CSV from the sidebar.
5. Share exported review files for aggregation.

This is a static site. Reviews are autosaved in each browser's local storage,
but they are not uploaded to GitHub automatically.

The review interface shows anonymized candidate numbers such as `Candidate 001`
instead of workflow or model names. Exported JSON/CSV files still retain the
underlying candidate identifiers so results can be aggregated after review.

The visible review UI also hides L2 judge scores and reasoning while reviewers
assign human scores. Project introduction and functional requirements are shown
below the diagrams to support blind human review.

## Included Data

This deployment contains a stratified human-review sample generated from the
available C-R2A-17 and G-R2A-52 evaluation CSV files. Candidate diagrams are
rendered as SVG under `assets/`, and reference diagrams are copied as static
image assets.
