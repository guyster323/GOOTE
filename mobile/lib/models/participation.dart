import 'package:cloud_firestore/cloud_firestore.dart';

class Participation {
  Participation({
    required this.id,
    required this.appId,
    required this.appName,
    required this.testerId,
    required this.status,
    required this.targetDays,
    required this.consecutiveDays,
    required this.lastCheckIn,
    required this.dailyChecks,
    required this.createdAt,
    required this.startDate,
    required this.endDate,
  });

  final String id;
  final String appId;
  final String appName;
  final String testerId;
  final String status;
  final int targetDays;
  final int consecutiveDays;
  final String? lastCheckIn;
  final Map<String, bool> dailyChecks;
  final DateTime? createdAt;
  final DateTime? startDate;
  final DateTime? endDate;

  factory Participation.fromDocument(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final rawChecks = (data['dailyChecks'] as Map<String, dynamic>?) ?? const <String, dynamic>{};

    return Participation(
      id: doc.id,
      appId: (data['appId'] as String?) ?? '',
      appName: (data['appName'] as String?) ?? '이름 없는 앱',
      testerId: (data['testerId'] as String?) ?? '',
      status: (data['status'] as String?) ?? 'unknown',
      targetDays: (data['targetDays'] as num?)?.toInt() ?? 14,
      consecutiveDays: (data['consecutiveDays'] as num?)?.toInt() ?? 0,
      lastCheckIn: data['lastCheckIn'] as String?,
      dailyChecks: rawChecks.map((key, value) => MapEntry(key, value == true)),
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
      startDate: (data['startDate'] as Timestamp?)?.toDate(),
      endDate: (data['endDate'] as Timestamp?)?.toDate(),
    );
  }
}
