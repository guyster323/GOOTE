import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/user_profile.dart';

class ProfileService {
  ProfileService({FirebaseFirestore? firestore})
      : _firestore = firestore ?? FirebaseFirestore.instance;

  final FirebaseFirestore _firestore;

  Stream<UserProfile?> watchProfile(String userId) {
    return _firestore.collection('users').doc(userId).snapshots().map((snapshot) {
      final data = snapshot.data();
      if (data == null) {
        return null;
      }
      final merged = <String, dynamic>{'uid': snapshot.id, ...data};
      return UserProfile.fromMap(merged);
    });
  }
}
