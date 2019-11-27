import { Attachment, AttachmentCreator, AttachmentRepository, AttachmentStorage } from "./attachment";

describe('no deps', () => {
	const repository = new AttachmentRepository();
	class AttachmentA extends Attachment {
		constructor(public ownerNameA: string) { super(); }
	}
	class AttachmentACreator extends AttachmentCreator<string, AttachmentA> {
		thisConstructor = AttachmentA;
		dependencies = [];
		async getAttachmentFor(owner: string, _storage: AttachmentStorage<string>): Promise<AttachmentA> {
			return new AttachmentA(owner);
		}
	}
	class AttachmentB extends Attachment {
		constructor(public dummyB: number, public ownerNameB: string) { super(); }
	}
	class AttachmentBCreator extends AttachmentCreator<string, AttachmentB> {
		thisConstructor = AttachmentB;
		dependencies = [];
		async getAttachmentFor(owner: string, _storage: AttachmentStorage<string>): Promise<AttachmentB> {
			return new AttachmentB(2, owner);
		}
	}
	class AttachmentC extends Attachment { }
	class AttachmentD extends Attachment { }
	class AttachmentDCreator extends AttachmentCreator<string, AttachmentD> {
		thisConstructor = AttachmentD;
		dependencies = [];
		async getAttachmentFor(_owner: string, _storage: AttachmentStorage<string>): Promise<AttachmentD> {
			throw new Error('test D');
		}
	}
	repository.addCreator(new AttachmentACreator());
	repository.addCreator(new AttachmentBCreator());
	repository.addCreator(new AttachmentDCreator());
	it('should should correctly resolve', async () => {
		const storage = await repository.getStorageFor('test');
		const a = storage.get(AttachmentA);
		expect(a.ownerNameA).toBe('test');
		const b = storage.get(AttachmentB);
		expect(b.dummyB).toBe(2);
		expect(b.ownerNameB).toBe('test');
	});

	it('should handle unregistered attachment creator', async () => {
		const storage = await repository.getStorageFor('test');
		expect(() => storage.get(AttachmentC)).toThrowError('Unknown dependency: AttachmentC');
	});

	it('should handle creator errors', async () => {
		const storage = await repository.getStorageFor('test');
		expect(() => storage.get(AttachmentD)).toThrowError('test D');
	});
});

// TODO: Handle more cases
describe('with deps', () => {
	const repository = new AttachmentRepository();
	class AttachmentA extends Attachment {
		constructor(public ownerNameA: string) { super(); }
	}
	class AttachmentACreator extends AttachmentCreator<string, AttachmentA> {
		thisConstructor = AttachmentA;
		dependencies = [];
		async getAttachmentFor(owner: string, _storage: AttachmentStorage<string>): Promise<AttachmentA> {
			return new AttachmentA(owner);
		}
	}
	class AttachmentB extends Attachment {
		constructor(public dummyB: number, public ownerNameB: string) { super(); }
	}
	class AttachmentBCreator extends AttachmentCreator<string, AttachmentB> {
		thisConstructor = AttachmentB;
		dependencies = [AttachmentA];
		async getAttachmentFor(owner: string, storage: AttachmentStorage<string>): Promise<AttachmentB> {
			return new AttachmentB(2, storage.get(AttachmentA).ownerNameA + '|modifiedByB');
		}
	}
	class AttachmentC extends Attachment { }
	repository.addCreator(new AttachmentACreator());
	repository.addCreator(new AttachmentBCreator());
	it('should should correctly resolve', async () => {
		const storage = await repository.getStorageFor('test');
		const a = storage.get(AttachmentA);
		expect(a.ownerNameA).toBe('test');
		const b = storage.get(AttachmentB);
		expect(b.dummyB).toBe(2);
		expect(b.ownerNameB).toBe('test|modifiedByB');
		expect(() => storage.get(AttachmentC)).toThrowError('Unknown dependency: AttachmentC');
	});
});
