const express = require('express');
const driveService = require('../services/google_drive_service');
const authMiddleware = require('../middlewares/auth_middleware');
const logger = require('../config/logger');

const mediaRouter = express.Router();

mediaRouter.get('/:fileId', async (req, res) => {
    const { fileId } = req.params;

    try {
        const fileMetadata = await driveService.getFileMetadata(fileId);

        if (!fileMetadata) {
            return res.status(404).json({ success: false, message: 'Arquivo nao localizado no storage.' });
        }

        const stream = await driveService.getFileStream(fileId);

        res.setHeader('Content-Type', fileMetadata.mimeType);
        res.setHeader('Content-Length', fileMetadata.size);
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=31536000');

        stream.on('error', (err) => {
            logger.error(`Erro no stream de mídia para o arquivo ${fileId}`, err);
            if (!res.headersSent) {
                res.status(500).end();
            }
        });

        stream.pipe(res);
    } catch (error) {
        logger.error(`Falha ao processar rota de mídia para ${fileId}`, error);
        res.status(404).json({ success: false, message: 'Arquivo nao disponível.' });
    }
});

mediaRouter.get('/download/:fileId', authMiddleware.authenticate, async (req, res) => {
    const { fileId } = req.params;
    try {
        const metadata = await driveService.getFileMetadata(fileId);
        const stream = await driveService.getFileStream(fileId);

        res.setHeader('Content-Disposition', `attachment; filename="${metadata.name}"`);
        res.setHeader('Content-Type', metadata.mimeType);

        stream.pipe(res);
    } catch (error) {
        res.status(500).end();
    }
});

mediaRouter.get('/thumbnail/:fileId', async (req, res) => {
    const { fileId } = req.params;
    try {
        const thumbUrl = await driveService.generateThumbnail(fileId);
        if (thumbUrl) {
            res.redirect(thumbUrl);
        } else {
            res.status(404).end();
        }
    } catch (error) {
        res.status(404).end();
    }
});

module.exports = mediaRouter;