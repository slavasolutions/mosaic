# 027 - required title resolved from H1 (MIP-0010)

Type `Post` declares `title: required: true`. The record `collections/posts/from-h1.md`
has no JSON sidecar, so there is no `title` field. The markdown body opens with
`# Resolved Title`. Per §2.3, required-title validation runs against the **resolved**
title; the H1 satisfies the constraint. No `mosaic.field.required` is emitted.
