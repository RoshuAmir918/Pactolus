import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});

async function main() {
    const nowResult = await pool.query('select now() as now');
    console.log('DB time:', nowResult.rows[0].now);

    const notesResult = await pool.query(
        'select id, note, created_at from learning_notes order by id'
    );
    console.log('learning_notes rows:', notesResult.rows);
}

main()
    .catch((err) => {
        console.error('db-check failed:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });