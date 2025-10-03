from sqlalchemy import create_engine, text
import os

# Simple migration to add cost_plan and cost_fact to schedules table if missing

def column_exists(engine, table_name, column_name):
    query = text(
        """
        SELECT 1
        FROM pragma_table_info(:table)
        WHERE name = :column
        """
    )
    with engine.connect() as conn:
        res = conn.execute(query, {"table": table_name, "column": column_name}).fetchone()
        return res is not None


def main():
    # Run from repo root or backend dir
    db_path = os.path.join(os.path.dirname(__file__), 'database.db')
    engine = create_engine(f"sqlite:///{db_path}")

    with engine.begin() as conn:
        if not column_exists(engine, "schedules", "cost_plan"):
            conn.execute(text("ALTER TABLE schedules ADD COLUMN cost_plan REAL"))
        if not column_exists(engine, "schedules", "cost_fact"):
            conn.execute(text("ALTER TABLE schedules ADD COLUMN cost_fact REAL"))

    print("Migration completed: cost_plan and cost_fact added if missing.")


if __name__ == "__main__":
    main()


