import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { leadCreateSchema, leadUpdateSchema, type Lead } from '@lims/shared';
import { LeadModelName, type LeadEntity } from './lead.schema';

@Injectable()
export class LeadsService {
  constructor(@InjectModel(LeadModelName) private readonly leadModel: Model<LeadEntity>) {}

  async create(body: unknown): Promise<Lead> {
    const parsed = leadCreateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const lead = await this.leadModel.create(parsed.data);
    return this.toLead(lead);
  }

  async list(): Promise<Lead[]> {
    const rows = await this.leadModel.find({}).sort({ createdAt: -1 }).limit(200).exec();
    return rows.map((row) => this.toLead(row));
  }

  async update(id: string, body: unknown): Promise<Lead> {
    const parsed = leadUpdateSchema.safeParse(body);
    if (!parsed.success)
      throw new BadRequestException(parsed.error.issues.map((issue) => issue.message).join(' '));
    const lead = await this.leadModel
      .findByIdAndUpdate(id, { $set: { status: parsed.data.status } }, { new: true })
      .exec();
    if (!lead) throw new NotFoundException('Lead not found.');
    return this.toLead(lead);
  }

  private toLead(row: LeadEntity): Lead {
    return {
      id: row._id.toString(),
      type: row.type,
      organizationName: row.organizationName,
      contactName: row.contactName,
      email: row.email,
      phone: row.phone,
      role: row.role,
      departments: row.departments,
      monthlyVolume: row.monthlyVolume,
      message: row.message,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
