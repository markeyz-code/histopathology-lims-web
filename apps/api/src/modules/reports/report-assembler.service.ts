import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { ReportDetail } from '@lims/shared';
import { toReportDetail, toReportVersion } from '../../common/serializers/entities';
import { UserModelName, type UserEntity } from '../users/user.schema';
import { ReportVersionModelName, type ReportVersionEntity } from './report-version.schema';
import { ReportModelName, type ReportEntity } from './report.schema';

@Injectable()
export class ReportAssemblerService {
  constructor(
    @InjectModel(ReportModelName) private readonly reportModel: Model<ReportEntity>,
    @InjectModel(ReportVersionModelName)
    private readonly versionModel: Model<ReportVersionEntity>,
    @InjectModel(UserModelName) private readonly userModel: Model<UserEntity>,
  ) {}

  async forCase(caseId: string): Promise<ReportDetail | null> {
    const report = await this.reportModel.findOne({ caseId: new Types.ObjectId(caseId) }).exec();
    return report ? this.assemble(report) : null;
  }

  async byId(reportId: string): Promise<ReportDetail | null> {
    const report = await this.reportModel.findById(reportId).exec();
    return report ? this.assemble(report) : null;
  }

  async assemble(report: ReportEntity): Promise<ReportDetail> {
    const versions = await this.versionModel
      .find({ reportId: report._id })
      .sort({ version: 1 })
      .exec();

    const userIds = new Set<string>();
    if (report.signedOutBy) userIds.add(report.signedOutBy.toString());
    if (report.releasedBy) userIds.add(report.releasedBy.toString());
    for (const version of versions) {
      if (version.createdBy) userIds.add(version.createdBy.toString());
    }
    const users =
      userIds.size > 0
        ? await this.userModel
            .find({ _id: { $in: Array.from(userIds).map((id) => new Types.ObjectId(id)) } })
            .exec()
        : [];
    const userMap = new Map(users.map((user) => [user._id.toString(), user]));
    const signer = report.signedOutBy ? (userMap.get(report.signedOutBy.toString()) ?? null) : null;
    const releaser = report.releasedBy ? (userMap.get(report.releasedBy.toString()) ?? null) : null;

    const versionDtos = versions.map((version) =>
      toReportVersion(
        version,
        version.createdBy ? (userMap.get(version.createdBy.toString()) ?? null) : null,
      ),
    );

    return toReportDetail(report, signer, versionDtos, releaser);
  }
}
