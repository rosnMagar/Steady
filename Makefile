PY=.venv/bin/python

verify:          ## fast offline+Snowflake tests (leakage, guardrails, data integrity)
	$(PY) -m pytest -q

model:           ## honest held-out model metrics
	$(PY) -m src.episode_model

backtest:        ## forecast backtest (MAE by horizon vs baselines)
	$(PY) -m src.backtest

eval-llm:        ## LLM behavioral eval (real Cortex calls)
	$(PY) -m src.eval_llm

verify-all: verify eval-llm  ## everything

.PHONY: verify model backtest eval-llm verify-all
