const { Pool } = require('pg');
const EventEmitter = require('events');

const NEON_CONNECTION_STRING = 'postgresql://neondb_owner:npg_tzKG1cYOg2JV@ep-billowing-scene-amoqz4x7-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

class DatabaseConnectionManager extends EventEmitter {
    constructor() {
        super();
        this.connectionString = NEON_CONNECTION_STRING;
        this.pool = null;
        this.isClosing = false;
        this.maxRetries = 10;
        this.retryDelay = 5000;
        this.metrics = {
            totalQueries: 0,
            failedQueries: 0,
            slowQueries: 0,
            totalTransactions: 0,
            activeConnections: 0
        };
    }

    initializePool() {
        const configuration = {
            connectionString: this.connectionString,
            max: 50,
            min: 10,
            idleTimeoutMillis: 60000,
            connectionTimeoutMillis: 10000,
            maxUses: 7500,
            allowExitOnIdle: false,
            ssl: {
                rejectUnauthorized: false
            }
        };

        this.pool = new Pool(configuration);

        this.pool.on('connect', (client) => {
            this.metrics.activeConnections++;
            this.emit('client_connected', { pid: client.processID });
        });

        this.pool.on('acquire', (client) => {
            this.emit('client_acquired', { pid: client.processID });
        });

        this.pool.on('remove', (client) => {
            this.metrics.activeConnections--;
            this.emit('client_removed', { pid: client.processID });
        });

        this.pool.on('error', (error, client) => {
            this.metrics.failedQueries++;
            this.emit('pool_error', {
                message: error.message,
                code: error.code,
                pid: client ? client.processID : null
            });
            this.handleUnexpectedError(error);
        });

        return this;
    }

    async connectWithRetry(attempt = 1) {
        if (!this.pool) this.initializePool();

        try {
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW() AS connection_time');
            client.release();

            console.log(`+-----------------------------------------------------------+`);
            console.log(`| NEONDB CONNECTION ESTABLISHED                             |`);
            console.log(`| ATTEMPT: ${attempt}                                                |`);
            console.log(`| TIMESTAMP: ${result.rows[0].connection_time}          |`);
            console.log(`+-----------------------------------------------------------+`);

            return true;
        } catch (error) {
            console.error(`Falha na conexao com banco de dados (Tentativa ${attempt}/${this.maxRetries}):`, error.message);

            if (attempt < this.maxRetries) {
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.connectWithRetry(attempt + 1);
            }

            throw new Error('Nao foi possivel estabelecer conexao com o NeonDB apos multiplas tentativas.');
        }
    }

    async query(text, params = []) {
        const start = Date.now();
        this.metrics.totalQueries++;

        try {
            const result = await this.pool.query(text, params);
            const duration = Date.now() - start;

            if (duration > 2000) {
                this.metrics.slowQueries++;
                this.emit('slow_query_detected', { text, duration, params });
            }

            return result;
        } catch (error) {
            this.metrics.failedQueries++;
            const enhancedError = this.translatePostgresError(error, text, params);
            this.emit('query_execution_error', enhancedError);
            throw enhancedError;
        }
    }

    async executeTransaction(callback) {
        const client = await this.pool.connect();
        this.metrics.totalTransactions++;

        try {
            await client.query('BEGIN');
            const result = await callback(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            const enhancedError = this.translatePostgresError(error);
            this.emit('transaction_failure', enhancedError);
            throw enhancedError;
        } finally {
            client.release();
        }
    }

    translatePostgresError(error, sql = '', params = []) {
        const errorDetails = {
            message: error.message,
            code: error.code,
            detail: error.detail,
            hint: error.hint,
            table: error.table,
            constraint: error.constraint,
            sql: sql,
            parameters: params,
            timestamp: new Date().toISOString()
        };

        switch (error.code) {
            case '23505':
                errorDetails.type = 'UNIQUE_VIOLATION';
                errorDetails.httpStatus = 409;
                break;
            case '23503':
                errorDetails.type = 'FOREIGN_KEY_VIOLATION';
                errorDetails.httpStatus = 400;
                break;
            case '23502':
                errorDetails.type = 'NOT_NULL_VIOLATION';
                errorDetails.httpStatus = 400;
                break;
            case '08003':
                errorDetails.type = 'CONNECTION_DOES_NOT_EXIST';
                errorDetails.httpStatus = 503;
                break;
            case '08006':
                errorDetails.type = 'CONNECTION_FAILURE';
                errorDetails.httpStatus = 503;
                break;
            case '42P01':
                errorDetails.type = 'UNDEFINED_TABLE';
                errorDetails.httpStatus = 500;
                break;
            case '42703':
                errorDetails.type = 'UNDEFINED_COLUMN';
                errorDetails.httpStatus = 500;
                break;
            case '57014':
                errorDetails.type = 'QUERY_CANCELED_TIMEOUT';
                errorDetails.httpStatus = 504;
                break;
            default:
                errorDetails.type = 'INTERNAL_DATABASE_ERROR';
                errorDetails.httpStatus = 500;
        }

        return errorDetails;
    }

    async checkHealth() {
        try {
            const start = Date.now();
            const result = await this.query('SELECT 1 AS alive');
            return {
                status: 'healthy',
                latency: `${Date.now() - start}ms`,
                timestamp: new Date().toISOString(),
                metrics: this.metrics,
                pool: {
                    total: this.pool.totalCount,
                    idle: this.pool.idleCount,
                    waiting: this.pool.waitingCount
                }
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    handleUnexpectedError(error) {
        if (this.isClosing) return;

        console.error('Erro inesperado no pool de banco de dados:', error.message);

        if (error.code === '57P01') {
            console.warn('Banco de dados esta reiniciando ou encerrando a conexao.');
            this.reconnectPool();
        }
    }

    async reconnectPool() {
        console.log('Iniciando processo de reconstrucao do pool...');
        try {
            await this.pool.end();
            this.initializePool();
            await this.connectWithRetry();
        } catch (error) {
            console.error('Falha ao reconstruir pool:', error.message);
        }
    }

    async shutdown() {
        this.isClosing = true;
        console.log('Encerrando pool de conexoes do banco de dados...');
        try {
            await this.pool.end();
            console.log('Pool encerrado com sucesso.');
        } catch (error) {
            console.error('Erro ao encerrar pool:', error.message);
        }
    }

    getPool() {
        return this.pool;
    }

    async runAdHocQuery(sql, params = []) {
        const client = await this.pool.connect();
        try {
            return await client.query(sql, params);
        } finally {
            client.release();
        }
    }

    async getTableMetadata(tableName) {
        const sql = `
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = $1
            ORDER BY ordinal_position;
        `;
        return await this.query(sql, [tableName]);
    }

    async listActiveProcesses() {
        const sql = `
            SELECT pid, state, query, query_start
            FROM pg_stat_activity
            WHERE datname = current_database()
            AND state != 'idle';
        `;
        return await this.query(sql);
    }

    async killProcess(pid) {
        const sql = 'SELECT pg_terminate_backend($1)';
        return await this.query(sql, [pid]);
    }

    async vacuumAnalyze() {
        const sql = 'VACUUM ANALYZE';
        return await this.query(sql);
    }

    async getDatabaseSize() {
        const sql = 'SELECT pg_size_pretty(pg_database_size(current_database()))';
        return await this.query(sql);
    }

    async getTableSize(tableName) {
        const sql = 'SELECT pg_size_pretty(pg_total_relation_size($1))';
        return await this.query(sql, [tableName]);
    }

    async explainQuery(text, params = []) {
        const sql = `EXPLAIN (FORMAT JSON, ANALYZE) ${text}`;
        return await this.query(sql, params);
    }

    async getActiveLocks() {
        const sql = `
            SELECT t.relname, l.locktype, l.mode, l.granted
            FROM pg_locks l
            JOIN pg_stat_all_tables t ON l.relation = t.relid
            WHERE t.schemaname = 'public';
        `;
        return await this.query(sql);
    }

    async getConstraints(tableName) {
        const sql = `
            SELECT conname, pg_get_constraintdef(oid)
            FROM pg_constraint
            WHERE conrelid = $1::regclass;
        `;
        return await this.query(sql, [tableName]);
    }

    async getTableIndexes(tableName) {
        const sql = `
            SELECT indexname, indexdef
            FROM pg_indexes
            WHERE tablename = $1;
        `;
        return await this.query(sql, [tableName]);
    }

    async resetPoolStats() {
        this.metrics = {
            totalQueries: 0,
            failedQueries: 0,
            slowQueries: 0,
            totalTransactions: 0,
            activeConnections: 0
        };
        return true;
    }

    async backupTableData(tableName) {
        const sql = `SELECT * FROM ${tableName}`;
        const result = await this.query(sql);
        return JSON.stringify(result.rows);
    }

    async getSessionInfo() {
        const sql = 'SELECT current_user, current_database(), version()';
        return await this.query(sql);
    }

    async checkConstraintValidity() {
        const sql = 'SELECT conname, confrelid::regclass, contype FROM pg_constraint WHERE convalidated = false';
        return await this.query(sql);
    }

    async listFunctions() {
        const sql = "SELECT routine_name FROM information_schema.routines WHERE routine_schema = 'public'";
        return await this.query(sql);
    }

    async listViews() {
        const sql = "SELECT viewname FROM pg_views WHERE schemaname = 'public'";
        return await this.query(sql);
    }

    async listTriggers() {
        const sql = "SELECT event_object_table, trigger_name, event_manipulation, action_statement FROM information_schema.triggers";
        return await this.query(sql);
    }

    async getLongRunningQueries(thresholdSeconds = 30) {
        const sql = `
            SELECT pid, now() - query_start AS duration, query, state
            FROM pg_stat_activity
            WHERE state != 'idle'
            AND (now() - query_start) > interval '${thresholdSeconds} seconds'
            ORDER BY duration DESC;
        `;
        return await this.query(sql);
    }

    async getDatabaseUptime() {
        const sql = 'SELECT now() - pg_postmaster_start_time() AS uptime';
        return await this.query(sql);
    }

    async setTransactionIsolationLevel(level) {
        const validLevels = ['READ UNCOMMITTED', 'READ COMMITTED', 'REPEATABLE READ', 'SERIALIZABLE'];
        if (!validLevels.includes(level)) throw new Error('Isolation level invalido');
        const sql = `SET SESSION CHARACTERISTICS AS TRANSACTION ISOLATION LEVEL ${level}`;
        return await this.query(sql);
    }

    async clearStatementTimeout() {
        return await this.query('SET statement_timeout = 0');
    }

    async setStatementTimeout(ms) {
        return await this.query(`SET statement_timeout = ${ms}`);
    }

    async getPoolConfig() {
        return {
            max: this.pool.options.max,
            min: this.pool.options.min,
            idleTimeout: this.pool.options.idleTimeoutMillis,
            connectionTimeout: this.pool.options.connectionTimeoutMillis
        };
    }

    async validateSchemaIntegrity() {
        const requiredTables = [
            'users', 'posts', 'reels', 'comments', 'likes',
            'followers', 'reposts', 'chat_rooms', 'chat_messages',
            'video_calls', 'points', 'referrals'
        ];

        const sql = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'";
        const result = await this.query(sql);
        const existingTables = result.rows.map(r => r.table_name);

        const missing = requiredTables.filter(t => !existingTables.includes(t));
        return {
            integrated: missing.length === 0,
            missing_tables: missing
        };
    }

    async getCurrentSchema() {
        return await this.query('SELECT current_schema()');
    }

    async getSettings() {
        return await this.query('SELECT name, setting, description FROM pg_settings WHERE category LIKE %Connection%');
    }

    async getReplicationStatus() {
        return await this.query('SELECT * FROM pg_stat_replication');
    }

    async getWalStatus() {
        return await this.query('SELECT * FROM pg_stat_wal');
    }

    async forceGarbageCollection() {
        if (global.gc) {
            global.gc();
            return true;
        }
        return false;
    }

    async diagnosticReport() {
        const health = await this.checkHealth();
        const schema = await this.validateSchemaIntegrity();
        const size = await this.getDatabaseSize();
        const uptime = await this.getDatabaseUptime();

        return {
            timestamp: new Date().toISOString(),
            engine: 'PostgreSQL (NeonDB)',
            health,
            schema,
            databaseSize: size.rows[0].pg_size_pretty,
            uptime: uptime.rows[0].uptime,
            metrics: this.metrics
        };
    }
}

const dbManagerInstance = new DatabaseConnectionManager();

module.exports = {
    manager: dbManagerInstance,
    query: (text, params) => dbManagerInstance.query(text, params),
    transaction: (callback) => dbManagerInstance.executeTransaction(callback),
    connect: () => dbManagerInstance.connectWithRetry(),
    shutdown: () => dbManagerInstance.shutdown(),
    health: () => dbManagerInstance.checkHealth(),
    diagnostics: () => dbManagerInstance.diagnosticReport(),
    getPool: () => dbManagerInstance.getPool()
};

function monitorSystemResources() {
    setInterval(async () => {
        const pool = dbManagerInstance.getPool();
        if (pool) {
            if (pool.waitingCount > 5) {
                console.warn(`Alerta de Contencao de Banco: ${pool.waitingCount} requisicoes aguardando conexao.`);
            }
        }
    }, 10000);
}

monitorSystemResources();

dbManagerInstance.on('slow_query_detected', (data) => {
    console.warn(`[PERFORMANCE WARNING] Query lenta detectada (${data.duration}ms):`, data.text);
});

dbManagerInstance.on('query_execution_error', (error) => {
    console.error(`[DATABASE ERROR] ${error.type} (${error.code}):`, error.message);
});

dbManagerInstance.on('pool_error', (error) => {
    console.error(`[POOL CRITICAL ERROR]`, error);
});

const gracefulShutdown = async () => {
    await dbManagerInstance.shutdown();
    process.exit(0);
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

const logConnectionDetails = () => {
    const redactedString = NEON_CONNECTION_STRING.replace(/:([^:@]+)@/, ':****@');
    console.log(`Database Manager configurado para: ${redactedString}`);
};

logConnectionDetails();

async function autoFixPool() {
    try {
        const pool = dbManagerInstance.getPool();
        if (pool && pool.totalCount === 0 && !dbManagerInstance.isClosing) {
            console.log('Detectada inatividade total no pool. Reaquecendo conexoes...');
            await dbManagerInstance.connectWithRetry();
        }
    } catch (e) {
        console.error('Falha no auto-fix do pool');
    }
}

setInterval(autoFixPool, 300000);

const auditLogSchema = async () => {
    try {
        const report = await dbManagerInstance.diagnosticReport();
        if (!report.schema.integrated) {
            console.error('AVISO: Esquema do banco de dados esta incompleto. Tabelas faltantes:', report.schema.missing_tables);
        }
    } catch (e) {}
};

setTimeout(auditLogSchema, 5000);

async function checkNeonCloudPerformance() {
    try {
        const start = Date.now();
        await dbManagerInstance.query('SELECT 1');
        const end = Date.now();
        console.log(`Latencia de rede NeonDB (Ping-Pong): ${end - start}ms`);
    } catch (e) {}
}

setInterval(checkNeonCloudPerformance, 600000);

async function listCurrentLocks() {
    try {
        const locks = await dbManagerInstance.getActiveLocks();
        if (locks.rows.length > 0) {
            console.log(`Locks ativos detectados: ${locks.rows.length}`);
        }
    } catch (e) {}
}

setInterval(listCurrentLocks, 300000);

console.log('Database Engine Layer: VlogStudents Core v1.0.0 carregado.');