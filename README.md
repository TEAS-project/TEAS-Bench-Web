# TEAS Benchmark

TEAS reports measured cost, accuracy, performance and energy for LLM inference across models, workloads, engines and accelerators.

- Dashboard: [teasbench.com](https://www.teasbench.com)
- Benchmark pipeline: [TEASBench](https://github.com/TEAS-project/TEASBench)

## Run locally

Install the dependencies and start the development server:

```bash
npm ci
npm run dev
```

Run the production check before submitting a change:

```bash
npm run build
```

## Data

The files under `public/data` are generated publication artifacts. Do not edit or regenerate them in this repository. The project’s publication workflow combines approved run data with live rent prices and writes the complete release.

All five JSON files under `public/data` are licensed under [CC BY 4.0](LICENSE-DATA). Published values use `measured`, `mixed` or `estimated` provenance labels where applicable. Unsupported values remain null.

## Contact

- Questions: [teas-bench-info@mlist.is.ed.ac.uk](mailto:teas-bench-info@mlist.is.ed.ac.uk)
- Contributions: [teas-bench-contribute@mlist.is.ed.ac.uk](mailto:teas-bench-contribute@mlist.is.ed.ac.uk)
- Corrections to published data: [teas-bench-report@mlist.is.ed.ac.uk](mailto:teas-bench-report@mlist.is.ed.ac.uk). Please include the affected configuration and supporting evidence.

## Licence

Every tracked file outside `public/data/*.json` is licensed under the [Apache License 2.0](LICENSE). The five generated JSON files are licensed separately under [CC BY 4.0](LICENSE-DATA). See [NOTICE](NOTICE) for attribution and funding information.
