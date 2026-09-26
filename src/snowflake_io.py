"""Snowflake connection + small helpers. Credentials come from .env (never hard-coded)."""
import os
from pathlib import Path
from contextlib import contextmanager
import pandas as pd
from dotenv import dotenv_values
import snowflake.connector
from snowflake.connector.pandas_tools import write_pandas

_ENV = dotenv_values(Path(__file__).resolve().parent.parent / ".env")


def _cfg(key: str) -> str:
    val = _ENV.get(key) or os.getenv(key)
    if not val:
        raise RuntimeError(f"{key} missing from .env")
    return val


@contextmanager
def connect():
    conn = snowflake.connector.connect(
        account=_cfg("SNOWFLAKE_ACCOUNT"),
        user=_cfg("SNOWFLAKE_USER"),
        password=_cfg("SNOWFLAKE_PASSWORD"),
        role=_cfg("SNOWFLAKE_ROLE"),
        warehouse=_cfg("SNOWFLAKE_WAREHOUSE"),
        database=_cfg("SNOWFLAKE_DATABASE"),
        schema=_cfg("SNOWFLAKE_SCHEMA"),
    )
    try:
        yield conn
    finally:
        conn.close()


def query(sql: str) -> pd.DataFrame:
    with connect() as c:
        cur = c.cursor()
        cur.execute(sql)
        if not cur.description:
            return pd.DataFrame()
        try:
            return cur.fetch_pandas_all()  # fast Arrow path for SELECTs
        except snowflake.connector.errors.NotSupportedError:
            cols = [d[0] for d in cur.description]  # SHOW/DDL results aren't Arrow
            return pd.DataFrame(cur.fetchall(), columns=cols)


def execute_script(path: str):
    """Run a multi-statement .sql file top to bottom."""
    text = Path(path).read_text()
    # strip line comments first so a ';' inside a comment doesn't split a statement
    no_comments = "\n".join(line.split("--", 1)[0] for line in text.splitlines())
    stmts = [s.strip() for s in no_comments.split(";") if s.strip()]
    with connect() as c:
        cur = c.cursor()
        for s in stmts:
            cur.execute(s)
    return len(stmts)


def load_dataframe(df: pd.DataFrame, table: str):
    """Overwrite-append a DataFrame into an existing table (column names must match, uppercased)."""
    df = df.copy().reset_index(drop=True)
    df.columns = [c.upper() for c in df.columns]
    with connect() as c:
        ok, nchunks, nrows, _ = write_pandas(c, df, table.upper(), quote_identifiers=False)
    return nrows


if __name__ == "__main__":
    print(query("SELECT CURRENT_ACCOUNT() AS account, CURRENT_WAREHOUSE() AS wh, "
                "CURRENT_DATABASE() AS db, CURRENT_SCHEMA() AS schema, CURRENT_VERSION() AS version").to_string(index=False))
