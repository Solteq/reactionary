# Runs the official UCP conformance suite
# (https://github.com/Universal-Commerce-Protocol/conformance) in isolation:
# all Python tooling lives in this image, nothing is installed on the host or
# added to the repository.
FROM python:3.12-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/* \
  && pip install --no-cache-dir uv

# Bump REFRESH (the run script's --refresh flag) to re-clone the latest suite.
ARG REFRESH=0
WORKDIR /suite
RUN echo "refresh=${REFRESH}" \
  && git clone --depth 1 https://github.com/Universal-Commerce-Protocol/conformance.git /suite/conformance

WORKDIR /suite/conformance
# The suite's pyproject points ucp-sdk at a sibling python-sdk checkout, whose
# main branch drifts ahead of the pinned ucp-sdk release. Drop the path
# override so uv resolves the pinned version from PyPI instead.
RUN sed -i '/^\[tool\.uv\.sources\]/,/^ucp-sdk/d' pyproject.toml \
  && uv sync

# The suite reads its merchant expectations from the default flower_shop
# config paths; overlay them with the reactionary/commercetools values.
COPY conformance_input.json test_data/flower_shop/conformance_input.json
COPY test_fixtures.json test_data/flower_shop/test_fixtures.json

ENTRYPOINT ["uv", "run", "pytest", "-q", "--color=yes"]
