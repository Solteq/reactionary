# hcl

This library was generated with [Nx](https://nx.dev).

## Building

Run `nx build hcl` to build the library.

## Running unit tests

Run `nx test hcl` to execute the unit tests via [Vitest](https://vitest.dev/).

## Product assets

The `productAssets` capability reads the attachments of a product (and of its SKUs) and returns the ones whose
attachment relation usage is mapped to an asset type: manuals, guides, certificates, warranties, videos, 3D models.
Attachments with any other usage, such as images, are ignored.

### Attachment usages

HCL Commerce stores the usage of an attachment in `ATCHRLUS` (identifier) and `ATCHRLUSDS` (name per language).
[setup/product-asset-usages.changelog.xml](setup/product-asset-usages.changelog.xml) is a Liquibase changelog that
creates the usages below. The ids are fixed, so every environment gets the same ones. Each changeSet is skipped
when its identifier or id already exists, so the script is safe to run again.

| ATCHRLUS_ID | IDENTIFIER | Asset type |
|---|---|---|
| 72000000 | `MANUAL` | `manual` |
| 72000001 | `USER_GUIDE` | `user-guide` |
| 72000002 | `INSTALLATION_GUIDE` | `installation-guide` |
| 72000003 | `DATASHEET` | `datasheet` |
| 72000004 | `CERTIFICATE` | `certificate` |
| 72000005 | `WARRANTY` | `warranty` |
| 72000006 | `SAFETY_DATA_SHEET` | `safety-data-sheet` |
| 72000007 | `ENERGY_LABEL` | `energy-label` |
| 72000008 | `PRODUCT_FICHE` | `product-fiche` |
| 72000009 | `VIDEO` | `video` |
| 72000010 | `MODEL_3D` | `3d-model` |
| 72000011 | `OTHER_ASSET` | `other` |

Run it against the HCL Commerce database with the Liquibase CLI:

```bash
liquibase \
  --changelog-file=packages/hcl/setup/product-asset-usages.changelog.xml \
  --url="jdbc:db2://<host>:<port>/<database>" --username=<user> --password=<password> \
  updateSQL   # review the SQL first, then run `update`
```

The script writes the English description (`LANGUAGE_ID = -1`). To add another language, insert a further
`ATCHRLUSDS` row for the usage with a new `ATCHRLUSDS_ID` (not in the 72000000 range used here), its `LANGUAGE_ID`
and the translated `NAME`. Shops that already have their own usages can skip the script and map those identifiers
instead with `productAssets.usageTypeMap` in the configuration.

### Configuration

```ts
productAssets: {
  // Added to the default map above, which is keyed by usage identifier.
  usageTypeMap: { MY_MANUAL_USAGE: 'manual' },
  // Relative attachment paths are made absolute against this; defaults to apiUrl.
  assetBaseUrl: 'https://assets.example.com',
}
```

The attachment usage must be part of the attachments in the product profile response (`profiles.product`).
