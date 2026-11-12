class UserProfile {
  UserProfile({
    required this.uid,
    required this.email,
    required this.nickname,
    required this.profileImage,
    required this.role,
    required this.dismissedGuides,
    required this.appsRegistered,
    required this.testsJoined,
    required this.testsCompleted,
    required this.totalLikes,
    required this.totalConsecutiveDays,
  });

  final String uid;
  final String email;
  final String nickname;
  final String profileImage;
  final String role;
  final List<String> dismissedGuides;
  final int appsRegistered;
  final int testsJoined;
  final int testsCompleted;
  final int totalLikes;
  final int totalConsecutiveDays;

  bool get isAdmin => role == 'admin';

  factory UserProfile.fromMap(Map<String, dynamic> data) {
    final stats = (data['stats'] as Map<String, dynamic>?) ?? const <String, dynamic>{};
    final dismissedGuides = (data['dismissedGuides'] as List<dynamic>?) ?? const [];

    return UserProfile(
      uid: (data['uid'] as String?) ?? '',
      email: (data['email'] as String?) ?? '',
      nickname: (data['nickname'] as String?) ?? '',
      profileImage: (data['profileImage'] as String?) ?? '',
      role: (data['role'] as String?) == 'admin' ? 'admin' : 'user',
      dismissedGuides: dismissedGuides.map((item) => item.toString()).toList(),
      appsRegistered: (stats['appsRegistered'] as num?)?.toInt() ?? 0,
      testsJoined: (stats['testsJoined'] as num?)?.toInt() ?? 0,
      testsCompleted: (stats['testsCompleted'] as num?)?.toInt() ?? 0,
      totalLikes: (stats['totalLikes'] as num?)?.toInt() ?? 0,
      totalConsecutiveDays: (stats['totalConsecutiveDays'] as num?)?.toInt() ?? 0,
    );
  }
}
