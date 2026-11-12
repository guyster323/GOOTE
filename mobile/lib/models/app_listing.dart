import 'package:cloud_firestore/cloud_firestore.dart';

class AppListing {
  AppListing({
    required this.id,
    required this.name,
    required this.status,
    required this.developerId,
    required this.developerNickname,
    required this.description,
    required this.packageName,
    required this.category,
    required this.googleGroupEmail,
    required this.googleGroupLink,
    required this.androidParticipationLink,
    required this.webParticipationLink,
    required this.testDuration,
    required this.minTesters,
    required this.participants,
    required this.dailyParticipants,
    required this.likes,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String status;
  final String developerId;
  final String developerNickname;
  final String description;
  final String packageName;
  final String category;
  final String googleGroupEmail;
  final String googleGroupLink;
  final String androidParticipationLink;
  final String webParticipationLink;
  final int testDuration;
  final int minTesters;
  final int participants;
  final int dailyParticipants;
  final int likes;
  final DateTime? createdAt;

  bool get isRecruiting => status == 'recruiting';

  factory AppListing.fromDocument(DocumentSnapshot<Map<String, dynamic>> doc) {
    final data = doc.data() ?? <String, dynamic>{};
    final stats = (data['stats'] as Map<String, dynamic>?) ?? const <String, dynamic>{};

    return AppListing(
      id: doc.id,
      name: (data['name'] as String?)?.trim() ?? '이름 없는 앱',
      status: (data['status'] as String?) ?? 'unknown',
      developerId: (data['developerId'] as String?) ?? '',
      developerNickname: (data['developerNickname'] as String?) ?? '',
      description: (data['description'] as String?) ?? '',
      packageName: (data['packageName'] as String?) ?? '',
      category: (data['category'] as String?) ?? 'other',
      googleGroupEmail: (data['googleGroupEmail'] as String?) ?? '',
      googleGroupLink: (data['googleGroupLink'] as String?) ?? '',
      androidParticipationLink: (data['androidParticipationLink'] as String?) ??
          (data['androidLink'] as String?) ??
          '',
      webParticipationLink: (data['webParticipationLink'] as String?) ??
          (data['webLink'] as String?) ??
          '',
      testDuration: (data['testDuration'] as num?)?.toInt() ?? 14,
      minTesters: (data['minTesters'] as num?)?.toInt() ?? 20,
      participants: (stats['participants'] as num?)?.toInt() ?? 0,
      dailyParticipants: (stats['dailyParticipants'] as num?)?.toInt() ?? 0,
      likes: (stats['likes'] as num?)?.toInt() ?? 0,
      createdAt: (data['createdAt'] as Timestamp?)?.toDate(),
    );
  }
}
