import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createServer, type Server, type Socket } from 'node:net';
import { Hl7Service } from './hl7.service';

const VT = '\u000b';
const FS = '\u001c';

@Injectable()
export class MllpServer implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MllpServer.name);
  private server: Server | null = null;
  private readonly buffers = new Map<Socket, string>();

  constructor(
    private readonly config: ConfigService,
    private readonly hl7: Hl7Service,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('HL7_ENABLED')) return;
    const port = this.config.get<number>('HL7_MLLP_PORT') ?? 2575;
    const allowed = (this.config.get<string>('HL7_ALLOWED_IPS') ?? '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);

    this.server = createServer((socket) => {
      const remote = socket.remoteAddress ?? '';
      if (allowed.length > 0 && !allowed.some((ip) => remote.endsWith(ip))) {
        this.logger.warn({ remote }, 'Rejected HL7 MLLP connection from an unlisted IP.');
        socket.destroy();
        return;
      }
      this.buffers.set(socket, '');
      socket.on('data', (chunk) => void this.onData(socket, chunk.toString('utf8')));
      socket.on('close', () => this.buffers.delete(socket));
      socket.on('error', (error) => {
        this.logger.warn({ err: error }, 'HL7 MLLP socket error.');
        this.buffers.delete(socket);
      });
    });

    this.server.on('error', (error) => this.logger.error({ err: error }, 'HL7 MLLP server error.'));
    this.server.listen(port, '0.0.0.0', () => {
      this.logger.log(`HL7 v2 MLLP listener ready on port ${port}.`);
    });
  }

  private async onData(socket: Socket, chunk: string): Promise<void> {
    let buffer = `${this.buffers.get(socket) ?? ''}${chunk}`;
    for (;;) {
      const start = buffer.indexOf(VT);
      const end = buffer.indexOf(FS, start + 1);
      if (start === -1 || end === -1) break;
      const message = buffer.slice(start + 1, end);
      buffer = buffer.slice(end + 2);
      try {
        const result = await this.hl7.ingest(message);
        socket.write(this.hl7.ackFrame(result.ack));
      } catch (error) {
        this.logger.error({ err: error }, 'HL7 message processing failed.');
        socket.write(
          this.hl7.ackFrame(
            `MSH|^~\\&|HISTOLIMS|LAB|EMR|HOSPITAL|${new Date()
              .toISOString()
              .replace(/[-:TZ.]/g, '')
              .slice(0, 14)}||ACK^O01|ACK-ERROR|P|2.5\rMSA|AE|ERROR|Internal processing error`,
          ),
        );
      }
    }
    this.buffers.set(socket, buffer);
  }

  onModuleDestroy(): void {
    this.server?.close();
  }
}
