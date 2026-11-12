import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:cloud_functions/cloud_functions.dart';

import '../models/participation.dart';

class ParticipationService {
  ParticipationService({
    FirebaseFirestore? firestore,
    FirebaseFunctions? functions,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _functions = functions ?? FirebaseFunctions.instanceFor(region: 'us-central1');

  final FirebaseFirestore _firestore;
  final FirebaseFunctions _functions;

  CollectionReference<Map<String, dynamic>> get _participations =>
      _firestore.collection('participations');

  Stream<List<Participation>> watchMyParticipations(String userId) {
    return _participations
        .where('testerId', isEqualTo: userId)
        .snapshots()
        .map(
          (snapshot) => snapshot.docs
              .map(Participation.fromDocument)
              .where((item) => ['active', 'pending', 'completed'].contains(item.status))
              .toList()
            ..sort((a, b) {
              final aTime = a.createdAt?.millisecondsSinceEpoch ?? 0;
              final bTime = b.createdAt?.millisecondsSinceEpoch ?? 0;
              return bTime.compareTo(aTime);
            }),
        );
  }

  Future<void> requestParticipation(String appId) async {
    final callable = _functions.httpsCallable('requestParticipation');
    await callable.call(<String, dynamic>{'appId': appId});
  }

  Future<String> createDailyTrackLink({
    required String participationId,
    required String type,
  }) async {
    final callable = _functions.httpsCallable('createDailyTrackLink');
    final result = await callable.call(<String, dynamic>{
      'participationId': participationId,
      'type': type,
    });

    final data = Map<String, dynamic>.from(result.data as Map);
    return (data['url'] as String?) ?? '';
  }
}
