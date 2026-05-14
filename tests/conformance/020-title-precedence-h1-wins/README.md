# 020 - title precedence: H1 satisfies required title

The record has no JSON `title` field but its markdown body starts with `# From H1`.
The type declares `title: required: true`. Per §2.3 ("required-title validation runs
against the resolved title"), the H1 satisfies the constraint. No `mosaic.field.required`
diagnostic. Resolved title is "From H1". This is the MIP-0010 case.
