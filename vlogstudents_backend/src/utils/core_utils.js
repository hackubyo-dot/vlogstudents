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
            quality: 0.95,
            margin: 1,
            color: {
                dark: '#CCFF00',
                light: '#000000'
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
    static isValidEmail(email) {
        const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        return regex.test(email);
    }

    static isValidPassword(password) {
        const regex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return regex.test(password);
    }

    static sanitizeUsername(name) {
        return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '').substring(0, 30);
    }

    static validateReelDuration(duration) {
        return duration >= 1 && duration <= 60;
    }

    static checkMimeType(mime, type) {
        const allowed = {
            video: ['video/mp4', 'video/quicktime', 'video/x-matroska', 'video/webm'],
            image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
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
            loadAverage: os.loadavg(),
            nodeVersion: process.version
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
}

class VlogStudentsSecurityUtils {
    static generateSecureToken(length = 64) {
        return crypto.randomBytes(length).toString('hex');
    }

    static computeFileHash(buffer) {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    static encrypt(text, secret) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(secret.substring(0, 32)), iv);
        let encrypted = cipher.update(text);
        encrypted = Buffer.concat([encrypted, cipher.final()]);
        return iv.toString('hex') + ':' + encrypted.toString('hex');
    }

    static decrypt(text, secret) {
        try {
            const textParts = text.split(':');
            const iv = Buffer.from(textParts.shift(), 'hex');
            const encryptedText = Buffer.from(textParts.join(':'), 'hex');
            const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(secret.substring(0, 32)), iv);
            let decrypted = decipher.update(encryptedText);
            decrypted = Buffer.concat([decrypted, decipher.final()]);
            return decrypted.toString();
        } catch (e) {
            return null;
        }
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
        return new Date(date).toLocaleDateString('pt-BR');
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

class VlogStudentsColorPalette {
    static getThemeColors(theme) {
        return theme === 'dark' ? {
            background: '#000000',
            primary: '#CCFF00',
            text: '#FFFFFF'
        } : {
            background: '#FFFFFF',
            primary: '#CCFF00',
            text: '#000000'
        };
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

class VlogStudentsBitrateCalculator {
    static estimateVideoSize(durationSeconds, bitrateKbps) {
        return (durationSeconds * bitrateKbps) / 8;
    }
}

class VlogStudentsUuidGenerator {
    static v4() {
        return crypto.randomUUID();
    }
}

const qrGenerator = new VlogStudentsQRGenerator();

module.exports = {
    QR: qrGenerator,
    Validator: VlogStudentsDataValidator,
    Diagnostics: VlogStudentsSystemDiagnostics,
    Security: VlogStudentsSecurityUtils,
    Formatter: VlogStudentsFormatter,
    Pagination: VlogStudentsPaginationHelper,
    Date: VlogStudentsDateUtils,
    Sanitizer: VlogStudentsObjectSanitizer,
    Response: VlogStudentsResponseWrapper,
    File: VlogStudentsFileHandler,
    Colors: VlogStudentsColorPalette,
    Async: VlogStudentsAsyncHandler,
    Uuid: VlogStudentsUuidGenerator,
    Video: VlogStudentsBitrateCalculator
};
