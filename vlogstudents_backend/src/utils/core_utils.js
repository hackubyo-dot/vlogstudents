const QRCode = require('qrcode');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const os = require('os');
const logger = require('../config/logger');

class VlogStudentsQRGenerator {
    constructor() {
        this.baseOptions = {
            errorCorrectionLevel: 'H',
            type: 'image/png',
            quality: 0.92,
            margin: 1,
            color: {
                dark: '#CCFF00',
                light: '#121212'
            }
        };
    }

    async generateReferralQR(referralCode) {
        const referralLink = `https://vlogstudents.com/invite/${referralCode}`;
        try {
            return await QRCode.toDataURL(referralLink, this.baseOptions);
        } catch (error) {
            logger.error(`Falha ao gerar QR Code para: ${referralCode}`, error);
            throw new Error('Falha no motor de geracao de QR Code.');
        }
    }

    async generateQRToFile(text, filePath) {
        try {
            await QRCode.toFile(filePath, text, this.baseOptions);
            return true;
        } catch (error) {
            return false;
        }
    }

    async generateBuffer(text) {
        return await QRCode.toBuffer(text, this.baseOptions);
    }
}

class VlogStudentsDataValidator {
    static isUniversityEmail(email) {
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.(edu|br)$/;
        return regex.test(email);
    }

    static isValidPassword(password) {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return regex.test(password);
    }

    static sanitizeUsername(name) {
        return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    }

    static validateReelDuration(duration) {
        return duration >= 3 && duration <= 60;
    }

    static checkMimeType(mime, type) {
        const allowed = {
            video: ['video/mp4', 'video/quicktime', 'video/x-matroska'],
            image: ['image/jpeg', 'image/png', 'image/webp']
        };
        return allowed[type].includes(mime);
    }
}

class VlogStudentsSystemDiagnostics {
    static getHardwareStats() {
        return {
            platform: os.platform(),
            architecture: os.arch(),
            cpus: os.cpus().length,
            freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
            totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
            uptime: `${Math.round(os.uptime() / 3600)}h`,
            loadAverage: os.loadavg()
        };
    }

    static getNetworkInterfaces() {
        const interfaces = os.networkInterfaces();
        const results = {};
        for (const name of Object.keys(interfaces)) {
            for (const iface of interfaces[name]) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    results[name] = iface.address;
                }
            }
        }
        return results;
    }

    static async checkDiskSpace() {
        return { status: 'monitoring_active' };
    }
}

class VlogStudentsSecurityUtils {
    static generateSecureToken(length = 32) {
        return crypto.randomBytes(length).toString('hex');
    }

    static computeFileHash(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    static encrypt(text, secret) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    static decrypt(text, secret) {
        const textParts = text.split(':');
        const iv = Buffer.from(textParts.shift(), 'hex');
        const encryptedText = Buffer.from(textParts.join(':'), 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret), iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    }
}

class VlogStudentsFormatter {
    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }

    static formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    static slugify(text) {
        return text.toString().toLowerCase().trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-');
    }

    static obscureEmail(email) {
        const [user, domain] = email.split('@');
        return `${user.substring(0, 3)}****@${domain}`;
    }
}

class VlogStudentsPaginationHelper {
    static getPaginationMetadata(totalItems, page, limit) {
        const totalPages = Math.ceil(totalItems / limit);
        return {
            totalItems: parseInt(totalItems),
            totalPages,
            currentPage: parseInt(page),
            pageSize: parseInt(limit),
            hasNextPage: page < totalPages,
            hasPreviousPage: page > 1
        };
    }
}

class VlogStudentsDateUtils {
    static getTimestamp() {
        return new Date().toISOString();
    }

    static addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    static isExpired(expiryDate) {
        return new Date() > new Date(expiryDate);
    }

    static getRelativeTime(date) {
        const now = new Date();
        const diff = now - new Date(date);
        const seconds = Math.floor(diff / 1000);
        if (seconds < 60) return 'agora mesmo';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `ha ${minutes}m`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `ha ${hours}h`;
        return new Date(date).toLocaleDateString();
    }
}

class VlogStudentsObjectSanitizer {
    static clean(obj) {
        const newObj = { ...obj };
        Object.keys(newObj).forEach(key => {
            if (newObj[key] === null || newObj[key] === undefined) {
                delete newObj[key];
            }
        });
        return newObj;
    }

    static deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }
}

class VlogStudentsLoggerHelper {
    static logRequestMetadata(req) {
        return {
            method: req.method,
            path: req.path,
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            userId: req.user ? req.user.id : 'guest'
        };
    }
}

class VlogStudentsResponseWrapper {
    static success(res, data, message = 'Sucesso', statusCode = 200) {
        return res.status(statusCode).json({
            success: true,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    static error(res, message = 'Erro interno', statusCode = 500, error_code = 'INTERNAL_ERROR') {
        return res.status(statusCode).json({
            success: false,
            message,
            error_code,
            timestamp: new Date().toISOString()
        });
    }
}

class VlogStudentsFileHandler {
    static async ensureDir(dirPath) {
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }

    static async deleteFileIfExists(filePath) {
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

class VlogStudentsUniversityManager {
    constructor() {
        this.supportedDomains = ['.edu', '.edu.br', '.ac.uk', '.mit.edu', '.harvard.edu'];
    }

    isAuthorizedDomain(email) {
        return this.supportedDomains.some(domain => email.endsWith(domain));
    }

    getUniversityFromEmail(email) {
        const domain = email.split('@')[1];
        return domain.split('.')[0].toUpperCase();
    }
}

class VlogStudentsColorPalette {
    static getThemeColors(theme) {
        return theme === 'dark' ? {
            background: '#121212',
            primary: '#CCFF00',
            text: '#FFFFFF'
        } : {
            background: '#FFFFFF',
            primary: '#CCFF00',
            text: '#121212'
        };
    }
}

class VlogStudentsSocialIntelligence {
    static calculateEngagementRate(likes, comments, views) {
        if (views === 0) return 0;
        return ((likes + comments) / views) * 100;
    }

    static detectMention(text) {
        const regex = /@(\w+)/g;
        return text.match(regex) || [];
    }

    static extractHashtags(text) {
        const regex = /#(\w+)/g;
        return text.match(regex) || [];
    }
}

class VlogStudentsGamificationEngine {
    static calculateLevelProgress(points, currentLevelMin, nextLevelMin) {
        const range = nextLevelMin - currentLevelMin;
        const earned = points - currentLevelMin;
        return Math.min((earned / range) * 100, 100);
    }
}

class VlogStudentsAsyncHandler {
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static async retry(fn, retries = 3, delay = 1000) {
        try {
            return await fn();
        } catch (error) {
            if (retries <= 0) throw error;
            await this.sleep(delay);
            return this.retry(fn, retries - 1, delay * 2);
        }
    }
}

class VlogStudentsValidationPresets {
    static get profileUpdateSchema() {
        return {
            fullName: { type: 'string', min: 3, max: 100 },
            biography: { type: 'string', max: 500 },
            university: { type: 'string', min: 2 }
        };
    }
}

class VlogStudentsTokenGenerator {
    static generateNumericCode(length = 6) {
        let code = '';
        for (let i = 0; i < length; i++) {
            code += Math.floor(Math.random() * 10).toString();
        }
        return code;
    }
}

class VlogStudentsHardwareAudit {
    static performCheck() {
        const stats = VlogStudentsSystemDiagnostics.getHardwareStats();
        if (parseInt(stats.freeMemory) < 200) {
            logger.warn('Alerta Critico de Memoria RAM no Servidor');
        }
        return stats;
    }
}

class VlogStudentsStreamHelper {
    static async pumpStream(source, destination) {
        return new Promise((resolve, reject) => {
            source.pipe(destination);
            source.on('end', resolve);
            source.on('error', reject);
        });
    }
}

class VlogStudentsMetricCollector {
    constructor() {
        this.start = Date.now();
    }

    getDuration() {
        return Date.now() - this.start;
    }
}

class VlogStudentsBatchProcessor {
    static async processInChunks(items, chunkSize, processor) {
        for (let i = 0; i < items.length; i += chunkSize) {
            const chunk = items.slice(i, i + chunkSize);
            await Promise.all(chunk.map(item => processor(item)));
        }
    }
}

class VlogStudentsJsonSanitizer {
    static parseSafe(json) {
        try {
            return JSON.parse(json);
        } catch (e) {
            return {};
        }
    }
}

class VlogStudentsUrlHelper {
    static isValidUrl(url) {
        try {
            new URL(url);
            return true;
        } catch (e) {
            return false;
        }
    }
}

class VlogStudentsEmojiFilter {
    static removeEmoji(text) {
        return text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '');
    }
}

class VlogStudentsUuidGenerator {
    static v4() {
        return crypto.randomUUID();
    }
}

class VlogStudentsPathResolver {
    static getUploadPath(category) {
        return path.join(process.cwd(), 'uploads', category);
    }
}

class VlogStudentsBitrateCalculator {
    static estimateVideoSize(durationSeconds, bitrateKbps) {
        return (durationSeconds * bitrateKbps) / 8;
    }
}

class VlogStudentsPerformanceMonitor {
    static trackEvent(name) {
        const mark = performance.mark(name);
        return mark;
    }
}

class VlogStudentsGlobalConstants {
    static get APP_NAME() { return 'VlogStudents'; }
    static get VERSION() { return '1.0.0'; }
    static get MAX_REEL_SIZE() { return 100 * 1024 * 1024; }
}

const qrGenerator = new VlogStudentsQRGenerator();
const universityManager = new VlogStudentsUniversityManager();

module.exports = {
    QR: qrGenerator,
    Validator: VlogStudentsDataValidator,
    Diagnostics: VlogStudentsSystemDiagnostics,
    Security: VlogStudentsSecurityUtils,
    Formatter: VlogStudentsFormatter,
    Pagination: VlogStudentsPaginationHelper,
    Date: VlogStudentsDateUtils,
    Sanitizer: VlogStudentsObjectSanitizer,
    Logger: VlogStudentsLoggerHelper,
    Response: VlogStudentsResponseWrapper,
    File: VlogStudentsFileHandler,
    University: universityManager,
    Colors: VlogStudentsColorPalette,
    Social: VlogStudentsSocialIntelligence,
    Gamification: VlogStudentsGamificationEngine,
    Async: VlogStudentsAsyncHandler,
    Token: VlogStudentsTokenGenerator,
    Audit: VlogStudentsHardwareAudit,
    Stream: VlogStudentsStreamHelper,
    Metrics: VlogStudentsMetricCollector,
    Batch: VlogStudentsBatchProcessor,
    Json: VlogStudentsJsonSanitizer,
    Url: VlogStudentsUrlHelper,
    Emoji: VlogStudentsEmojiFilter,
    Uuid: VlogStudentsUuidGenerator,
    Path: VlogStudentsPathResolver,
    Video: VlogStudentsBitrateCalculator,
    Performance: VlogStudentsPerformanceMonitor,
    Constants: VlogStudentsGlobalConstants
};

logger.info('VlogStudents Utility Core v1.0.0 carregado com sucesso.');